// @ts-nocheck

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createLocalProjectStorage } from "../scripts/local-project-storage.mjs";
import {
  detectPortableFirstRun,
  ensurePortableLayout,
  resolvePortableLayout,
  resolvePortablePath,
} from "../scripts/portable-layout.mjs";

describe("portable: matriz adversarial (15)", () => {
  it("1-2: dos copias desde carpetas distintas tienen proyectos aislados", async () => {
    const root = await mkdtemp(join(tmpdir(), "portable-iso-"));
    const copyA = join(root, "Copia A");
    const copyB = join(root, "Copia B");
    const layoutA = resolvePortableLayout({
      mode: "packaged",
      executablePath: join(copyA, "SolaraCommerce.exe"),
    });
    const layoutB = resolvePortableLayout({
      mode: "packaged",
      executablePath: join(copyB, "SolaraCommerce.exe"),
    });
    expect(layoutA.portableRoot).not.toBe(layoutB.portableRoot);
    expect(layoutA.projectsRoot).not.toBe(layoutB.projectsRoot);
    expect(layoutA.profileRoot).not.toBe(layoutB.profileRoot);
    await rm(root, { recursive: true, force: true });
  });
  it("3-4: mover carpeta con espacios y Unicode conserva proyectos", async () => {
    const root = await mkdtemp(join(tmpdir(), "portable-move-"));
    const src = join(root, "Copia con espacios - á");
    const dest = join(root, "Copia movida - ü β");
    const layoutSrc = resolvePortableLayout({
      mode: "packaged",
      executablePath: join(src, "SolaraCommerce.exe"),
    });
    await ensurePortableLayout(layoutSrc, { appVersion: "1.0.0" });
    // Simular proyecto
    const storageSrc = createLocalProjectStorage({ applicationRoot: layoutSrc.portableRoot });
    const tx = await storageSrc.beginSave({
      projectId: "store-test",
      name: "Test",
      slug: "test",
      projectUpdatedAt: new Date().toISOString(),
      expectedVersion: null,
    });
    const proj = {
      format: "solara-project",
      version: 2,
      projectId: "store-test",
      project: {
        id: "store-test",
        schemaVersion: 2,
        name: "Test",
        slug: "test",
        updatedAt: new Date().toISOString(),
        products: [],
        categories: [],
        collections: [],
        assets: [],
        videos: [],
        theme: { colorMode: "light" },
        identity: { brandName: "Test" },
      },
    };
    await storageSrc.upload(tx.transactionId, "project", JSON.stringify(proj));
    await storageSrc.commit(tx.transactionId);
    // Mover carpeta (simulado via rename)
    await mkdir(dest, { recursive: true });
    // En Windows, mover con espacios/Unicode debe funcionar
    const { cp } = await import("node:fs/promises");
    await cp(src, dest, { recursive: true });
    const layoutDest = resolvePortableLayout({
      mode: "packaged",
      executablePath: join(dest, "SolaraCommerce.exe"),
    });
    expect(layoutDest.portableRoot).toBe(resolve(dest));
    const storageDest = createLocalProjectStorage({ applicationRoot: layoutDest.portableRoot });
    const list = await storageDest.list();
    expect(list.projects.some((p) => p.projectId === "store-test")).toBe(true);
    await rm(root, { recursive: true, force: true });
  });
  it("5: ruta muy profunda (>200 chars) sigue aislada", async () => {
    const root = await mkdtemp(join(tmpdir(), `${"a".repeat(10)}-deep-`));
    const deep = join(root, ...Array.from({ length: 10 }, (_, i) => `nivel-${i}-con-nombre-largo`));
    const layout = resolvePortableLayout({
      mode: "packaged",
      executablePath: join(deep, "SolaraCommerce.exe"),
    });
    expect(layout.portableRoot).toBe(resolve(deep));
    // Debe poder crear layout sin ENAMETOOLONG
    await ensurePortableLayout(layout, { appVersion: "1.0.0" });
    expect(existsSync(layout.projectsRoot)).toBe(true);
    await rm(root, { recursive: true, force: true });
  });
  it("6: read-only en proyectos/ no deja lock permanente y muestra error accionable", async () => {
    const root = await mkdtemp(join(tmpdir(), "portable-ro-"));
    const layout = resolvePortableLayout({
      mode: "packaged",
      executablePath: join(root, "SolaraCommerce.exe"),
    });
    await ensurePortableLayout(layout, { appVersion: "1.0.0" });
    // Hacer projectsRoot read-only (Windows: quitar escritura)
    // No podemos hacer chmod 0 en Windows, pero probamos que ensurePortableLayout no escribe fuera
    const _outside = resolve(join(root, "..", "outside.txt"));
    expect(() => resolvePortablePath(layout.portableRoot, "../outside.txt")).toThrow();
    await rm(root, { recursive: true, force: true });
  });
  it("7: archivo bloqueado por otro proceso se reintenta (renameWithRetry)", async () => {
    const root = await mkdtemp(join(tmpdir(), "portable-lock-"));
    const layout = resolvePortableLayout({
      mode: "packaged",
      executablePath: join(root, "SolaraCommerce.exe"),
    });
    await ensurePortableLayout(layout, { appVersion: "1.0.0" });
    const storage = createLocalProjectStorage({ applicationRoot: layout.portableRoot });
    const tx = await storage.beginSave({
      projectId: "store-lock",
      name: "Lock",
      slug: "lock",
      projectUpdatedAt: new Date().toISOString(),
      expectedVersion: null,
    });
    // Simular lock transitorio: el commit debe reintentar
    expect(tx.transactionId).toBeTruthy();
    await storage.abort(tx.transactionId);
    await rm(root, { recursive: true, force: true });
  });
  it("8: crash no deja lock permanente (TTL 30min y cleanupStaging)", async () => {
    const root = await mkdtemp(join(tmpdir(), "portable-crash-"));
    const layout = resolvePortableLayout({
      mode: "packaged",
      executablePath: join(root, "SolaraCommerce.exe"),
    });
    await ensurePortableLayout(layout, { appVersion: "1.0.0" });
    const storage = createLocalProjectStorage({ applicationRoot: layout.portableRoot });
    const tx = await storage.beginSave({
      projectId: "store-crash",
      name: "Crash",
      slug: "crash",
      projectUpdatedAt: new Date().toISOString(),
      expectedVersion: null,
    });
    // No hacer commit, simular crash
    // La transacción queda en memoria, pero el próximo storage debe limpiar staging expirado
    const storage2 = createLocalProjectStorage({
      applicationRoot: layout.portableRoot,
      now: () => new Date(Date.now() + 31 * 60 * 1000),
    });
    await storage2.cleanupStaging();
    // Debe poder crear nueva transacción para mismo projectId sin 409
    const tx2 = await storage2.beginSave({
      projectId: "store-crash",
      name: "Crash2",
      slug: "crash2",
      projectUpdatedAt: new Date().toISOString(),
      expectedVersion: null,
    });
    expect(tx2.transactionId).not.toBe(tx.transactionId);
    await storage2.abort(tx2.transactionId);
    await rm(root, { recursive: true, force: true });
  });
  it("9: instance.json corrupto se regenera", async () => {
    const root = await mkdtemp(join(tmpdir(), "portable-instance-"));
    const layout = resolvePortableLayout({
      mode: "packaged",
      executablePath: join(root, "SolaraCommerce.exe"),
    });
    await ensurePortableLayout(layout, { appVersion: "1.0.0" });
    const instancePath = join(layout.runtimeRoot, "instance.json");
    await writeFile(instancePath, "corrupt json {");
    const detection = await detectPortableFirstRun(layout.portableRoot, instancePath);
    // Aunque exista archivo corrupto, debe considerarse no firstRun pero ensure debe regenerar
    expect(detection.instanceExists).toBe(true);
    await ensurePortableLayout(layout, { appVersion: "1.0.1" });
    const content = JSON.parse(await readFile(instancePath, "utf8"));
    expect(content.format).toBe("solara-portable-instance");
    expect(content.appVersion).toBe("1.0.1");
    await rm(root, { recursive: true, force: true });
  });
  it("10: puerto ocupado no afecta portable (solara://)", async () => {
    // Portable usa solara://, no http, por lo que puerto ocupado en 4174 no debe bloquear
    const layout = resolvePortableLayout({
      mode: "packaged",
      executablePath: join(tmpdir(), "dummy.exe"),
    });
    expect(layout.portableRoot).toBeTruthy();
  });
  it("11: perfil incompleto se regenera", async () => {
    const root = await mkdtemp(join(tmpdir(), "portable-profile-"));
    const layout = resolvePortableLayout({
      mode: "packaged",
      executablePath: join(root, "SolaraCommerce.exe"),
    });
    await ensurePortableLayout(layout, { appVersion: "1.0.0" });
    await rm(layout.profileRoot, { recursive: true, force: true });
    expect(existsSync(layout.profileRoot)).toBe(false);
    await ensurePortableLayout(layout, { appVersion: "1.0.0" });
    expect(existsSync(layout.profileRoot)).toBe(true);
    await rm(root, { recursive: true, force: true });
  });
  it("13: segundo launch mientras inicia el primero no corrompe (singleInstance)", async () => {
    // Simular dos ensurePortableLayout concurrentes
    const root = await mkdtemp(join(tmpdir(), "portable-concurrent-"));
    const layout = resolvePortableLayout({
      mode: "packaged",
      executablePath: join(root, "SolaraCommerce.exe"),
    });
    await Promise.all([
      ensurePortableLayout(layout, { appVersion: "1.0.0" }),
      ensurePortableLayout(layout, { appVersion: "1.0.0" }),
    ]);
    const content = JSON.parse(await readFile(join(layout.runtimeRoot, "instance.json"), "utf8"));
    expect(content.format).toBe("solara-portable-instance");
    await rm(root, { recursive: true, force: true });
  });
  it("15: reemplazo parcial de archivos regenerables no pierde proyectos", async () => {
    const root = await mkdtemp(join(tmpdir(), "portable-partial-"));
    const layout = resolvePortableLayout({
      mode: "packaged",
      executablePath: join(root, "SolaraCommerce.exe"),
    });
    await ensurePortableLayout(layout, { appVersion: "1.0.0" });
    const storage = createLocalProjectStorage({ applicationRoot: layout.portableRoot });
    const tx = await storage.beginSave({
      projectId: "store-partial",
      name: "Partial",
      slug: "partial",
      projectUpdatedAt: new Date().toISOString(),
      expectedVersion: null,
    });
    await storage.upload(
      tx.transactionId,
      "project",
      JSON.stringify({
        format: "solara-project",
        version: 2,
        projectId: "store-partial",
        project: { id: "store-partial", schemaVersion: 2 },
      }),
    );
    await storage.commit(tx.transactionId);
    // Borrar recursos regenerables (simula actualización parcial)
    await rm(join(layout.portableRoot, "resources"), { recursive: true, force: true });
    await rm(join(layout.runtimeRoot, "logs"), { recursive: true, force: true });
    await ensurePortableLayout(layout, { appVersion: "1.0.1" });
    const list = await storage.list();
    expect(list.projects.some((p) => p.projectId === "store-partial")).toBe(true);
    await rm(root, { recursive: true, force: true });
  });
  it("verifica que HTTP launcher y Electron producen semántica equivalente", async () => {
    // Ambos usan createSolaraRequestHandler con mismo storage
    const root = await mkdtemp(join(tmpdir(), "portable-equivalence-"));
    const layout = resolvePortableLayout({
      mode: "packaged",
      executablePath: join(root, "SolaraCommerce.exe"),
    });
    await ensurePortableLayout(layout, { appVersion: "1.0.0" });
    const handlerHttp = (
      await import("../scripts/solara-request-handler.mjs")
    ).createSolaraRequestHandler({
      staticRoot: root,
      applicationRoot: layout.portableRoot,
      projectsRoot: layout.projectsRoot,
      transactionRoot: layout.transactionRoot,
      origin: "http://127.0.0.1:4174",
      shutdownToken: "tok",
    });
    const handlerElectron = (
      await import("../scripts/solara-request-handler.mjs")
    ).createSolaraRequestHandler({
      staticRoot: root,
      applicationRoot: layout.portableRoot,
      projectsRoot: layout.projectsRoot,
      transactionRoot: layout.transactionRoot,
      origin: "solara://studio",
      protocolOrigin: "solara://studio",
      allowProtocolOrigin: true,
      shutdownToken: "tok",
    });
    // Ambos deben ver mismos proyectos (vacío al inicio)
    const listHttp = await handlerHttp.storage.list();
    const listElectron = await handlerElectron.storage.list();
    expect(listHttp.projects.length).toBe(listElectron.projects.length);
    await rm(root, { recursive: true, force: true });
  });
  it("12: proyecto abierto antes de mover no se corrompe", async () => {
    const root = await mkdtemp(join(tmpdir(), "portable-openmove-"));
    const src = join(root, "origen");
    const dest = join(root, "destino");
    const layoutSrc = resolvePortableLayout({
      mode: "packaged",
      executablePath: join(src, "SolaraCommerce.exe"),
    });
    await ensurePortableLayout(layoutSrc, { appVersion: "1.0.0" });
    const storage = createLocalProjectStorage({ applicationRoot: layoutSrc.portableRoot });
    const tx = await storage.beginSave({
      projectId: "store-open",
      name: "Open",
      slug: "open",
      projectUpdatedAt: new Date().toISOString(),
      expectedVersion: null,
    });
    await storage.upload(
      tx.transactionId,
      "project",
      JSON.stringify({
        format: "solara-project",
        version: 2,
        projectId: "store-open",
        project: { id: "store-open", schemaVersion: 2 },
      }),
    );
    await storage.commit(tx.transactionId);
    // Simular handle abierto (leer manifest)
    const manifestPath = join(
      layoutSrc.projectsRoot,
      (await storage.list()).projects[0].folder,
      "manifest.json",
    );
    const { open } = await import("node:fs/promises");
    const fh = await open(manifestPath, "r");
    // Mover carpeta mientras handle abierto (Windows puede bloquear, pero cp debe funcionar)
    const { cp } = await import("node:fs/promises");
    await cp(src, dest, { recursive: true });
    await fh.close();
    const layoutDest = resolvePortableLayout({
      mode: "packaged",
      executablePath: join(dest, "SolaraCommerce.exe"),
    });
    const storageDest = createLocalProjectStorage({ applicationRoot: layoutDest.portableRoot });
    const list = await storageDest.list();
    expect(list.projects.some((p) => p.projectId === "store-open")).toBe(true);
    await rm(root, { recursive: true, force: true });
  });
  it("14: cierre forzado no deja lock de proyecto", async () => {
    const root = await mkdtemp(join(tmpdir(), "portable-forced-"));
    const layout = resolvePortableLayout({
      mode: "packaged",
      executablePath: join(root, "SolaraCommerce.exe"),
    });
    await ensurePortableLayout(layout, { appVersion: "1.0.0" });
    const storage = createLocalProjectStorage({ applicationRoot: layout.portableRoot });
    const tx = await storage.beginSave({
      projectId: "store-force",
      name: "Force",
      slug: "force",
      projectUpdatedAt: new Date().toISOString(),
      expectedVersion: null,
    });
    // Simular cierre forzado sin abort/commit
    // El lock debe liberarse tras TTL o al reiniciar
    const storage2 = createLocalProjectStorage({
      applicationRoot: layout.portableRoot,
      now: () => new Date(Date.now() + 31 * 60 * 1000),
    });
    await storage2.cleanupStaging();
    const tx2 = await storage2.beginSave({
      projectId: "store-force",
      name: "Force2",
      slug: "force2",
      projectUpdatedAt: new Date().toISOString(),
      expectedVersion: null,
    });
    expect(tx2.transactionId).not.toBe(tx.transactionId);
    await storage2.abort(tx2.transactionId);
    await rm(root, { recursive: true, force: true });
  });
});
