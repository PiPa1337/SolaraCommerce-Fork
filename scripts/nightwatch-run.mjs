import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";

const spec = process.argv[2];
const logPath = process.argv[3];
if (!spec || !logPath) {
  console.error("usage: node scripts/nightwatch-run.mjs <spec> <log>");
  process.exit(1);
}
console.log("[nightwatch-run] starting", spec, "->", logPath);
const cmd = `corepack pnpm exec playwright test "${spec}" --workers=1 --retries=0 --reporter=list`;
console.log("[nightwatch-run] cmd", cmd);
const log = createWriteStream(logPath);
log.on("error", (err) => {
  console.error("log error", err);
});
console.log("[nightwatch-run] log created");
const proc = spawn(cmd, { stdio: ["ignore", "pipe", "pipe"], shell: true });
proc.stdout.on("data", (d) => {
  log.write(d);
  process.stdout.write(d);
});
proc.stderr.on("data", (d) => {
  log.write(d);
  process.stderr.write(d);
});
proc.on("close", (code) => {
  log.end(() => process.exit(code ?? 0));
});
proc.on("error", (err) => {
  console.error(err);
  process.exit(1);
});
