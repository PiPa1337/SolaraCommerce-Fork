import { createHash } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const AGENT_LOCK_TTL_MS = 30 * 60 * 1000;

function lockRoot(applicationRoot) {
  return join(applicationRoot, ".solara-runtime", "agent", "locks");
}

function lockPath(applicationRoot, projectId) {
  const key = createHash("sha256").update(projectId).digest("hex");
  return join(lockRoot(applicationRoot), `${key}.json`);
}

function lockError(projectId, lock) {
  const error = new Error(`La tienda ${projectId} está siendo editada por un agente.`);
  error.code = "AGENT_LOCKED";
  error.details = {
    projectId,
    ownerId: lock?.ownerId,
    expiresAt: lock?.expiresAt,
  };
  return error;
}

async function writeAtomic(pathname, value) {
  const temporary = `${pathname}.tmp-${process.pid}-${Date.now()}`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporary, pathname);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

export function createAgentLockStore({ applicationRoot, now = () => new Date() }) {
  async function read(projectId) {
    const pathname = lockPath(applicationRoot, projectId);
    try {
      const lock = JSON.parse(await readFile(pathname, "utf8"));
      if (
        lock?.projectId !== projectId ||
        typeof lock.ownerId !== "string" ||
        Date.parse(lock.expiresAt) <= now().getTime()
      ) {
        await rm(pathname, { force: true });
        return undefined;
      }
      return lock;
    } catch (error) {
      if (error?.code === "ENOENT") return undefined;
      throw error;
    }
  }

  async function claim(projectId, ownerId, metadata = {}) {
    if (!projectId || !ownerId) throw new Error("La tienda y el dueño del lock son obligatorios.");
    await mkdir(lockRoot(applicationRoot), { recursive: true });
    const current = await read(projectId);
    if (current && current.ownerId !== ownerId) throw lockError(projectId, current);
    const acquiredAt = current?.acquiredAt ?? now().toISOString();
    const lock = {
      format: "solara-agent-lock",
      version: 1,
      projectId,
      ownerId,
      acquiredAt,
      heartbeatAt: now().toISOString(),
      expiresAt: new Date(now().getTime() + AGENT_LOCK_TTL_MS).toISOString(),
      ...metadata,
    };
    const pathname = lockPath(applicationRoot, projectId);
    if (!current) {
      try {
        const handle = await open(pathname, "wx");
        try {
          await handle.writeFile(`${JSON.stringify(lock, null, 2)}\n`, "utf8");
          await handle.sync();
        } finally {
          await handle.close();
        }
      } catch (error) {
        if (error?.code === "EEXIST") {
          const raced = await read(projectId);
          throw lockError(projectId, raced);
        }
        throw error;
      }
    } else {
      await writeAtomic(pathname, lock);
    }
    return lock;
  }

  async function heartbeat(projectId, ownerId) {
    const current = await read(projectId);
    if (!current || current.ownerId !== ownerId) throw lockError(projectId, current);
    return claim(projectId, ownerId, { acquiredAt: current.acquiredAt });
  }

  async function release(projectId, ownerId) {
    const pathname = lockPath(applicationRoot, projectId);
    const current = await read(projectId);
    if (current && current.ownerId === ownerId) await rm(pathname, { force: true });
  }

  async function assertAvailable(projectId, ownerId) {
    const current = await read(projectId);
    if (current && current.ownerId !== ownerId) throw lockError(projectId, current);
    return current;
  }

  return { claim, heartbeat, release, read, assertAvailable, root: lockRoot(applicationRoot) };
}

export { lockPath };
