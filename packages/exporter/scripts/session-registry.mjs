/** Registro regenerable de servidores locales administrados por SolaraCommerce. */

import { readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { writeJsonAtomic } from "./local-layout.mjs";

export const LOCAL_SESSION_FORMAT = "solara-local-session";
export const LOCAL_SESSION_VERSION = 1;

function validSessionId(sessionId) {
  return typeof sessionId === "string" && /^[a-zA-Z0-9_-]{8,128}$/.test(sessionId);
}

export function isLocalSessionRecord(value, { applicationRoot } = {}) {
  return Boolean(
    value &&
      value.format === LOCAL_SESSION_FORMAT &&
      value.version === LOCAL_SESSION_VERSION &&
      validSessionId(value.sessionId) &&
      Number.isInteger(value.processId) &&
      value.processId > 0 &&
      Number.isInteger(value.port) &&
      value.port >= 1 &&
      value.port <= 65535 &&
      typeof value.projectRoot === "string" &&
      (!applicationRoot || value.projectRoot === applicationRoot) &&
      typeof value.startedAt === "string" &&
      !Number.isNaN(Date.parse(value.startedAt)) &&
      value.managed === true &&
      typeof value.shutdownToken === "string" &&
      value.shutdownToken.length >= 16,
  );
}

export function sessionRecordPath(layout, sessionId) {
  if (!validSessionId(sessionId)) throw new Error("El identificador de sesión local es inválido.");
  return join(layout.instancesRoot, `${sessionId}.json`);
}

export async function writeSessionRecord(layout, record) {
  if (!isLocalSessionRecord(record, { applicationRoot: layout.applicationRoot })) {
    throw new Error("El registro de sesión local es inválido.");
  }
  const pathname = sessionRecordPath(layout, record.sessionId);
  await writeJsonAtomic(pathname, record);
  return pathname;
}

export async function removeSessionRecord(layout, sessionId) {
  const pathname = sessionRecordPath(layout, sessionId);
  await rm(pathname, { force: true });
}

export async function listSessionRecords(layout, { cleanInvalid = false } = {}) {
  let files;
  try {
    files = await readdir(layout.instancesRoot);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const records = [];
  for (const file of files.filter((entry) => entry.endsWith(".json"))) {
    const pathname = join(layout.instancesRoot, file);
    try {
      const value = JSON.parse(await readFile(pathname, "utf8"));
      if (!isLocalSessionRecord(value, { applicationRoot: layout.applicationRoot })) {
        throw new Error("Registro inválido.");
      }
      records.push(value);
    } catch {
      if (cleanInvalid) await rm(pathname, { force: true });
    }
  }
  return records.sort(
    (left, right) => left.port - right.port || left.startedAt.localeCompare(right.startedAt),
  );
}
