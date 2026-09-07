import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const trayExe = join(repositoryRoot, "Abrir SolaraCommerce.exe");
const serveScript = join(repositoryRoot, "packages", "exporter", "scripts", "serve.mjs");
const ports = Array.from({ length: 8 }, (_, index) => 4173 + index);
const children = new Set();
const mockServers = new Set();
const skipped = [];

function token() {
  return randomBytes(24).toString("base64url");
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function waitFor(predicate, message, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      if (await predicate()) return;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`${message}${lastError ? `: ${lastError.message}` : ""}`);
}

async function isPortFree(port) {
  return new Promise((resolveFree) => {
    const server = createNetServer();
    server.unref();
    server.once("error", () => resolveFree(false));
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolveFree(true));
    });
  });
}

async function freePorts() {
  const states = await Promise.all(ports.map(async (port) => [port, await isPortFree(port)]));
  return states.filter(([, free]) => free).map(([port]) => port);
}

async function readJson(pathname) {
  return JSON.parse((await readFile(pathname, "utf8")).replace(/^\uFEFF/, ""));
}

async function runTray(root, diagnostic, sessionId = "") {
  const output = join(root, `.diag-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  const args = ["--root", root, "--output", output, diagnostic];
  if (sessionId) args.push(sessionId);
  const code = await new Promise((resolveExit, reject) => {
    const child = spawn(trayExe, args, {
      cwd: repositoryRoot,
      windowsHide: true,
      stdio: "ignore",
    });
    child.once("error", reject);
    child.once("exit", (exitCode) => resolveExit(exitCode ?? 1));
  });
  const result = await readJson(output);
  await rm(output, { force: true });
  return { code, result };
}

async function probe(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/__solara/session`, {
      signal: AbortSignal.timeout(800),
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function startManaged(root, staticRoot, port, sessionId) {
  const shutdownToken = token();
  const child = spawn(
    process.execPath,
    [serveScript, staticRoot, String(port), shutdownToken, root, sessionId],
    { cwd: repositoryRoot, windowsHide: true, stdio: "ignore" },
  );
  children.add(child);
  child.once("exit", () => children.delete(child));
  await waitFor(async () => {
    const session = await probe(port);
    return session?.managed === true && session.sessionId === sessionId;
  }, `La sesión ${sessionId} no inició en ${port}`);
  const recordPath = join(root, ".solara-runtime", "instances", `${sessionId}.json`);
  await stat(recordPath);
  return { child, port, sessionId, shutdownToken, recordPath };
}

async function closeManagedHttp(session) {
  const origin = `http://127.0.0.1:${session.port}`;
  const response = await fetch(`${origin}/__solara/shutdown`, {
    method: "POST",
    headers: {
      Cookie: `solara_shutdown=${session.shutdownToken}`,
      Origin: origin,
      Referer: `${origin}/`,
    },
  });
  assert.equal(response.status, 202);
  await waitFor(
    async () => (await probe(session.port)) === null,
    `La sesión ${session.sessionId} no cerró`,
  );
  await waitFor(async () => {
    try {
      await stat(session.recordPath);
      return false;
    } catch (error) {
      return error?.code === "ENOENT";
    }
  }, `El registro ${session.sessionId} no fue retirado`);
}

async function startMock(port, handler) {
  const server = createHttpServer(handler);
  mockServers.add(server);
  await new Promise((resolveListening, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolveListening);
  });
  return server;
}

async function closeServer(server) {
  if (!server?.listening) return;
  await new Promise((resolveClose) => server.close(resolveClose));
  mockServers.delete(server);
}

async function writeRecord(root, value) {
  const instances = join(root, ".solara-runtime", "instances");
  await mkdir(instances, { recursive: true });
  const pathname = join(instances, `${value.sessionId}.json`);
  await writeFile(pathname, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return pathname;
}

function record(root, port, sessionId, shutdownToken, processId = process.pid) {
  return {
    format: "solara-local-session",
    version: 1,
    sessionId,
    processId,
    port,
    projectRoot: root,
    startedAt: new Date().toISOString(),
    managed: true,
    shutdownToken,
  };
}

async function writeRestartLauncher(root) {
  const scriptsRoot = join(root, "scripts");
  await mkdir(scriptsRoot, { recursive: true });
  await writeFile(
    join(scriptsRoot, "restart-server.mjs"),
    `import { createServer } from "node:http";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [root, portText, sessionId, shutdownToken] = process.argv.slice(2);
const port = Number(portText);
const recordPath = join(root, ".solara-runtime", "instances", sessionId + ".json");
const sessionPayload = JSON.stringify({ managed: true, sessionId });
let stopping = false;
let server;

async function stop() {
  if (stopping) return;
  stopping = true;
  await rm(recordPath, { force: true }).catch(() => {});
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
}

server = createServer((request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.url === "/__solara/session") {
    response.end(sessionPayload);
    return;
  }
  if (request.method === "POST" && request.url === "/__solara/shutdown") {
    const expectedCookie = "solara_shutdown=" + shutdownToken;
    if ((request.headers.cookie || "").indexOf(expectedCookie) < 0) {
      response.statusCode = 403;
      response.end(JSON.stringify({ ok: false }));
      return;
    }
    response.statusCode = 202;
    response.end(JSON.stringify({ ok: true }));
    void stop();
    return;
  }
  response.statusCode = 404;
  response.end(JSON.stringify({ ok: false }));
});

await mkdir(join(root, ".solara-runtime", "instances"), { recursive: true });
await new Promise((resolveListen) => server.listen(port, "127.0.0.1", resolveListen));
await writeFile(
  recordPath,
  JSON.stringify({
    format: "solara-local-session",
    version: 1,
    sessionId,
    processId: process.pid,
    port,
    projectRoot: root,
    startedAt: new Date().toISOString(),
    managed: true,
    shutdownToken,
  }) + "\\n",
  "utf8",
);
process.once("SIGTERM", () => void stop());
process.once("SIGINT", () => void stop());
`,
    "utf8",
  );
  await writeFile(
    join(scriptsRoot, "open-solara.ps1"),
    String.raw`param(
  [switch]$NoBrowser,
  [switch]$NewSession,
  [switch]$Json
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$serverScript = Join-Path $PSScriptRoot "restart-server.mjs"
$nodePath = (Get-Command node).Source
$port = 0
foreach ($candidate in 4173..4180) {
  $listener = $null
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $candidate)
    $listener.Start()
    $port = $candidate
  } catch {
  } finally {
    if ($null -ne $listener) { $listener.Stop() }
  }
  if ($port -gt 0) { break }
}
if ($port -eq 0) { [Console]::Error.WriteLine("No hay un puerto libre"); exit 1 }

$sessionId = [Guid]::NewGuid().ToString("N")
$shutdownToken = ([Guid]::NewGuid().ToString("N") + [Guid]::NewGuid().ToString("N"))
$arguments = @(
  ('"' + $serverScript + '"'),
  ('"' + $root + '"'),
  "$port",
  ('"' + $sessionId + '"'),
  ('"' + $shutdownToken + '"')
)
$serverProcess = Start-Process -FilePath $nodePath -ArgumentList $arguments -WorkingDirectory $root -WindowStyle Hidden -PassThru
$ready = $false
for ($attempt = 0; $attempt -lt 40; $attempt++) {
  try {
    $probe = Invoke-RestMethod -Uri "http://127.0.0.1:$port/__solara/session" -Method Get -TimeoutSec 1
    if ($probe.managed -eq $true -and $probe.sessionId -eq $sessionId) {
      $ready = $true
      break
    }
  } catch {
  }
  Start-Sleep -Milliseconds 100
}
if (-not $ready) {
  if (-not $serverProcess.HasExited) { Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue }
  throw "El servidor temporal no respondió."
}
[pscustomobject]@{
  sessionId = $sessionId
  port = $port
  url = "http://127.0.0.1:$port"
} | ConvertTo-Json -Compress | Write-Output
`,
    "utf8",
  );
}

async function main() {
  await stat(trayExe);
  const root = await mkdtemp(join(tmpdir(), "solara-tray-smoke-"));
  const staticRoot = join(root, "site");
  await mkdir(staticRoot, { recursive: true });
  await writeFile(
    join(staticRoot, "index.html"),
    "<!doctype html><title>Tray smoke</title>",
    "utf8",
  );
  await writeRestartLauncher(root);

  try {
    let available = await freePorts();
    if (available.length < 1) {
      skipped.push("detección/cierre: ningún puerto 4173-4180 disponible");
    } else {
      const sessions = [];
      const targetCount = Math.min(5, available.length);
      for (let index = 0; index < targetCount; index++) {
        const session = await startManaged(
          root,
          staticRoot,
          available[index],
          `tray-smoke-${index + 1}`,
        );
        sessions.push(session);
        if (index === 0 || index === 1 || index === 4) {
          const diagnostic = await runTray(root, "--diagnostic-list");
          assert.equal(diagnostic.code, 0);
          assert.equal(diagnostic.result.count, index + 1);
        }
      }
      if (targetCount < 5)
        skipped.push(`detección de 5 sesiones: sólo ${targetCount} puertos libres`);

      if (sessions.length >= 2) {
        const closing = sessions[1];
        const closeOne = await runTray(root, "--diagnostic-close", closing.sessionId);
        assert.equal(closeOne.code, 0);
        assert.equal(closeOne.result.failures, 0);
        assert.equal(closeOne.result.count, sessions.length - 1);
        assert.equal(await probe(closing.port), null);
        const survivor = await probe(sessions[0].port);
        assert.equal(survivor?.sessionId, sessions[0].sessionId);
      } else {
        skipped.push("cierre individual: requiere al menos 2 puertos libres");
      }

      const closeAll = await runTray(root, "--diagnostic-close-all");
      assert.equal(closeAll.code, 0);
      assert.equal(closeAll.result.failures, 0);
      assert.equal(closeAll.result.count, 0);
    }

    const instancesRoot = join(root, ".solara-runtime", "instances");
    await mkdir(instancesRoot, { recursive: true });
    const corruptPath = join(instancesRoot, "corrupt.json");
    await writeFile(corruptPath, "{broken", "utf8");
    const corruptCheck = await runTray(root, "--diagnostic-list");
    assert.equal(corruptCheck.code, 0);
    assert.equal(corruptCheck.result.count, 0);
    await assert.rejects(stat(corruptPath), { code: "ENOENT" });

    available = await freePorts();
    if (available.length >= 1) {
      const mismatchPort = available[0];
      const mismatch = await startMock(mismatchPort, (request, response) => {
        response.setHeader("Content-Type", "application/json");
        if (request.url === "/__solara/session") {
          response.end(JSON.stringify({ managed: true, sessionId: "otra-sesion" }));
        } else {
          response.statusCode = 404;
          response.end("{}");
        }
      });
      const mismatchPath = await writeRecord(
        root,
        record(root, mismatchPort, "session-esperada", token()),
      );
      const mismatchCheck = await runTray(root, "--diagnostic-list");
      assert.equal(mismatchCheck.result.count, 0);
      await assert.rejects(stat(mismatchPath), { code: "ENOENT" });
      await closeServer(mismatch);
    } else {
      skipped.push("puerto reasignado: ningún puerto libre");
    }

    available = await freePorts();
    if (available.length >= 1) {
      const failurePort = available[0];
      const failureId = "shutdown-failure";
      const failureToken = token();
      const sleeper = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
        windowsHide: true,
        stdio: "ignore",
      });
      children.add(sleeper);
      sleeper.once("exit", () => children.delete(sleeper));
      const failingServer = await startMock(failurePort, (request, response) => {
        response.setHeader("Content-Type", "application/json");
        if (request.url === "/__solara/session") {
          response.end(JSON.stringify({ managed: true, sessionId: failureId }));
          return;
        }
        if (request.url === "/__solara/shutdown") {
          response.statusCode = 403;
          response.end(JSON.stringify({ ok: false }));
          return;
        }
        response.statusCode = 404;
        response.end("{}");
      });
      const failurePath = await writeRecord(
        root,
        record(root, failurePort, failureId, failureToken, sleeper.pid),
      );
      const failedClose = await runTray(root, "--diagnostic-close", failureId);
      assert.equal(failedClose.code, 1);
      assert.equal(failedClose.result.failures, 1);
      assert.equal(failedClose.result.count, 1);
      assert.equal(sleeper.exitCode, null, "El tray no debe matar el PID informativo");
      await rm(failurePath, { force: true });
      await closeServer(failingServer);
      sleeper.kill();
    } else {
      skipped.push("shutdown fallido: ningún puerto libre");
    }

    available = await freePorts();
    if (available.length >= 1) {
      const session = await startManaged(root, staticRoot, available[0], "studio-shutdown");
      await closeManagedHttp(session);
    } else {
      skipped.push("shutdown HTTP real: ningún puerto libre");
    }

    available = await freePorts();
    if (available.length >= 1) {
      const session = await startManaged(root, staticRoot, available[0], "restart-before");
      const restarted = await runTray(root, "--diagnostic-restart");
      assert.equal(restarted.code, 0);
      assert.equal(restarted.result.failures, 0);
      assert.equal(restarted.result.count, 1);
      assert.equal(restarted.result.sessions.length, 1);
      assert.notEqual(restarted.result.sessions[0].sessionId, session.sessionId);
      assert.equal(
        (await probe(restarted.result.sessions[0].port))?.sessionId,
        restarted.result.sessions[0].sessionId,
      );
      const restartedClose = await runTray(root, "--diagnostic-close-all");
      assert.equal(restartedClose.code, 0);
      assert.equal(restartedClose.result.count, 0);
    } else {
      skipped.push("reinicio de aplicación: ningún puerto libre");
    }

    available = await freePorts();
    if (available.length === ports.length) {
      const maxSessions = [];
      for (let index = 0; index < ports.length; index++) {
        maxSessions.push(
          await startManaged(root, staticRoot, ports[index], `max-session-${index + 1}`),
        );
      }
      assert.deepEqual(await freePorts(), []);
      const ninth = spawn(
        process.execPath,
        [serveScript, staticRoot, String(ports[0]), token(), root, "ninth-session"],
        { cwd: repositoryRoot, windowsHide: true, stdio: "ignore" },
      );
      const ninthCode = await new Promise((resolveExit) =>
        ninth.once("exit", (code) => resolveExit(code ?? 1)),
      );
      assert.notEqual(ninthCode, 0);
      const maxClose = await runTray(root, "--diagnostic-close-all");
      assert.equal(maxClose.code, 0);
      assert.equal(maxClose.result.count, 0);
      void maxSessions;
    } else {
      skipped.push(
        `límite 8/9: ${ports.length - available.length} puerto(s) ya estaban ocupados externamente`,
      );
    }

    console.log(`tray-smoke: ok${skipped.length ? `; omitidos: ${skipped.join(" | ")}` : ""}`);
  } finally {
    await runTray(root, "--diagnostic-close-all").catch(() => {});
    for (const server of [...mockServers]) {
      await closeServer(server).catch(() => {});
    }
    for (const child of [...children]) {
      if (child.exitCode === null) child.kill();
    }
    await rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
