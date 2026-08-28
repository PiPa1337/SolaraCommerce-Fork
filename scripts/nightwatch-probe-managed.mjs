import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = mkdtempSync(join(tmpdir(), "nightwatch-probe-"));
const port = 4977;
const token = "probe-token";
const server = spawn(
  process.execPath,
  [
    resolve("packages/exporter/scripts/serve.mjs"),
    resolve("apps/studio/dist"),
    String(port),
    token,
    root,
  ],
  { stdio: "inherit" },
);

async function waitUp() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch("http://127.0.0.1:" + port + "/__solara/session");
      if (res.ok) return res;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("server did not start");
}

try {
  const session = await waitUp();
  const cookie = (session.headers.get("set-cookie") || "").split(";")[0];
  const status = await fetch("http://127.0.0.1:" + port + "/__solara/storage/status", {
    headers: { cookie },
  });
  console.log("STATUS", status.status, await status.text());

  const begin = await fetch("http://127.0.0.1:" + port + "/__solara/storage/saves", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({
      projectId: "store-modo-sur-demo",
      name: "Predeterminado",
      slug: "demo-catalogo-jerarquico",
      projectUpdatedAt: new Date().toISOString(),
      expectedVersion: null,
    }),
  });
  console.log("BEGIN DEMO", begin.status, await begin.text());
  if (begin.ok) {
    const started = await begin.json();
    const projectBytes = new TextEncoder().encode(
      JSON.stringify({
        format: "solara-project",
        version: 2,
        project: { schemaVersion: 2, id: "store-modo-sur-demo" },
      }),
    );
    const hash = createHash("sha256").update(projectBytes).digest("hex");
    const upload = await fetch(
      "http://127.0.0.1:" + port + "/__solara/storage/saves/" + started.transactionId + "/project",
      {
        method: "PUT",
        headers: {
          cookie,
          "content-type": "application/vnd.solara.project+json",
          "x-solara-sha256": hash,
        },
        body: projectBytes,
      },
    );
    console.log("UPLOAD", upload.status, await upload.text());
    const commit = await fetch(
      "http://127.0.0.1:" + port + "/__solara/storage/saves/" + started.transactionId + "/commit",
      { method: "POST", headers: { cookie } },
    );
    console.log("COMMIT", commit.status, await commit.text());
  }

  const list = await fetch("http://127.0.0.1:" + port + "/__solara/storage/projects", {
    headers: { cookie, accept: "application/json" },
  });
  console.log("LIST", list.status, (await list.text()).slice(0, 500));
} finally {
  server.kill();
}
