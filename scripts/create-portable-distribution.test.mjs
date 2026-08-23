import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { shouldKeepPortableStore } from "./create-portable-distribution.mjs";

async function writeStoreManifest(dir, version) {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "manifest.json"), JSON.stringify({ current: { version } }), "utf8");
}

async function writeHealthyStore(dir, version, savedAt, content = `project-${version}`) {
  const currentPath = join(dir, "actual", "current.solara.json");
  const bytes = Buffer.from(content, "utf8");
  await mkdir(join(dir, "actual"), { recursive: true });
  await writeFile(currentPath, bytes);
  await writeFile(
    join(dir, "manifest.json"),
    JSON.stringify({
      format: "solara-local-project",
      manifestVersion: 2,
      current: {
        version,
        projectPath: "actual/current.solara.json",
        sha256: createHash("sha256").update(bytes).digest("hex"),
        savedAt,
      },
    }),
    "utf8",
  );
}

describe("shouldKeepPortableStore", () => {
  it("mantiene la tienda del portable cuando tiene un guardado más nuevo", async () => {
    const root = await mkdtemp(join(tmpdir(), "portable-keep-"));
    try {
      const preserved = join(root, "preserved");
      const repo = join(root, "repo");
      await writeStoreManifest(preserved, 41);
      await writeStoreManifest(repo, 40);
      expect(await shouldKeepPortableStore(preserved, repo)).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("no pisa la versión del repo cuando es igual o más nueva", async () => {
    const root = await mkdtemp(join(tmpdir(), "portable-skip-"));
    try {
      const preserved = join(root, "preserved");
      const repo = join(root, "repo");
      await writeStoreManifest(preserved, 40);
      await writeStoreManifest(repo, 40);
      expect(await shouldKeepPortableStore(preserved, repo)).toBe(false);
      await writeStoreManifest(repo, 42);
      expect(await shouldKeepPortableStore(preserved, repo)).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("recupera la tienda del portable si el repo no la tiene", async () => {
    const root = await mkdtemp(join(tmpdir(), "portable-only-"));
    try {
      const preserved = join(root, "preserved");
      await writeStoreManifest(preserved, 7);
      expect(await shouldKeepPortableStore(preserved, join(root, "repo-missing"))).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("ignora carpetas sin manifest o vacías", async () => {
    const root = await mkdtemp(join(tmpdir(), "portable-empty-"));
    try {
      const preserved = join(root, "preserved");
      const repo = join(root, "repo");
      await mkdir(preserved, { recursive: true });
      await mkdir(repo, { recursive: true });
      expect(await shouldKeepPortableStore(preserved, repo)).toBe(false);
      expect(await shouldKeepPortableStore(join(root, "missing"), repo)).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("prefiere la copia sana del portable frente a una copia con hash roto", async () => {
    const root = await mkdtemp(join(tmpdir(), "portable-health-"));
    try {
      const preserved = join(root, "preserved");
      const repo = join(root, "repo");
      await writeHealthyStore(preserved, 41, "2026-08-07T11:00:00.000Z");
      await writeHealthyStore(repo, 42, "2026-08-07T12:00:00.000Z");
      await writeFile(join(repo, "actual", "current.solara.json"), "altered", "utf8");
      expect(await shouldKeepPortableStore(preserved, repo)).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("prefiere el portable sano cuando ambas copias tienen la misma versión", async () => {
    const root = await mkdtemp(join(tmpdir(), "portable-tie-"));
    try {
      const preserved = join(root, "preserved");
      const repo = join(root, "repo");
      await writeHealthyStore(preserved, 42, "2026-08-07T12:00:00.000Z", "portable");
      await writeHealthyStore(repo, 42, "2026-08-07T12:00:00.000Z", "repo");
      expect(await shouldKeepPortableStore(preserved, repo)).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
