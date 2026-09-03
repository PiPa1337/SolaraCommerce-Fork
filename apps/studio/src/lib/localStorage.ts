/**
 * Cliente del API loopback de persistencia. Centraliza sesión, streams binarios,
 * hashes y errores de conflicto para que Studio no construya rutas de disco ni
 * envíe proyectos grandes como JSON/base64.
 */
export interface LocalStorageStatus {
  managed: boolean;
  writable: boolean;
  projectsRoot?: string;
  transactionRoot?: string;
}

export interface LocalProjectSummary {
  projectId: string;
  name: string;
  slug: string;
  status: "synced" | "site-outdated" | "recovery-required";
  updatedAt: string;
  savedAt: string;
  version: number;
  folder: string;
  siteVersion: number | null;
  siteOutdated: boolean;
}

export interface LocalStorageRecovery {
  folder: string;
  message: string;
  projectId?: string;
  version?: number;
}

export interface LocalProjectManifestSummary {
  projects: LocalProjectSummary[];
  recovery: LocalStorageRecovery[];
}

export interface LocalSaveMetadata {
  projectId: string;
  name: string;
  slug: string;
  projectUpdatedAt: string;
  expectedVersion: number | null;
  /** Canal autorizado de plantilla: sólo el bootstrap/migración de la base protegida lo envía. */
  actor?: { kind: "template-upgrade" };
  allowProtectedWrite?: boolean;
}

export interface LocalSaveReceipt {
  projectId: string;
  version: number;
  key: string;
  status: "synced" | "site-outdated";
  folder: string;
  projectPath: string;
  site: {
    version: number;
    key: string;
    directoryPath: string;
    sha256: string;
    savedAt: string;
  } | null;
}

export class LocalStorageError extends Error {
  constructor(
    message: string,
    readonly code = "LOCAL_STORAGE_ERROR",
  ) {
    super(message);
    this.name = "LocalStorageError";
  }
}

async function readError(response: Response): Promise<never> {
  let message = `El servidor local respondió ${response.status}.`;
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error) message = body.error;
  } catch {
    // El servidor puede cerrar la conexión sin un JSON de error.
  }
  throw new LocalStorageError(
    message,
    response.status === 409 ? "VERSION_CONFLICT" : "LOCAL_STORAGE_ERROR",
  );
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { credentials: "same-origin", ...init });
  if (!response.ok) return readError(response);
  return (await response.json()) as T;
}

export async function getLocalStorageStatus(): Promise<LocalStorageStatus> {
  const session = await fetch("/__solara/session", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!session.ok) return { managed: false, writable: false };
  const sessionBody = (await session.json()) as { managed?: unknown };
  if (sessionBody.managed !== true) return { managed: false, writable: false };
  const result = await requestJson<{ ok?: boolean } & LocalStorageStatus>(
    "/__solara/storage/status",
    {
      headers: { Accept: "application/json" },
    },
  );
  return {
    managed: result.managed === true,
    writable: result.writable === true,
    ...(result.projectsRoot ? { projectsRoot: result.projectsRoot } : {}),
    ...(result.transactionRoot ? { transactionRoot: result.transactionRoot } : {}),
  };
}

export async function listLocalProjects(): Promise<LocalProjectManifestSummary> {
  const result = await requestJson<{ ok?: boolean } & LocalProjectManifestSummary>(
    "/__solara/storage/projects",
    { headers: { Accept: "application/json" } },
  );
  return { projects: result.projects, recovery: result.recovery };
}

/**
 * Ejecuta la migración acotada de referencias V1 en el almacenamiento
 * administrado. El servidor sólo conoce los dos IDs reservados de la demo;
 * no es un endpoint de borrado general de tiendas.
 */
export async function retireLegacyDemoProjectsOnDisk(): Promise<string[]> {
  const result = await requestJson<{ removedProjectIds?: unknown }>(
    "/__solara/storage/migrations/retire-legacy-demo",
    {
      method: "POST",
      headers: { Accept: "application/json" },
    },
  );
  return Array.isArray(result.removedProjectIds)
    ? result.removedProjectIds.filter(
        (projectId): projectId is string => typeof projectId === "string",
      )
    : [];
}

export async function readLocalProject(projectId: string): Promise<Uint8Array> {
  const response = await fetch(
    `/__solara/storage/projects/${encodeURIComponent(projectId)}/current`,
    { credentials: "same-origin", headers: { Accept: "application/vnd.solara.project+json" } },
  );
  if (!response.ok) return readError(response);
  return new Uint8Array(await response.arrayBuffer());
}

async function uploadBytes(url: string, bytes: Uint8Array, contentType: string): Promise<void> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const body = new Blob([copy.buffer], { type: contentType });
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  const sha256 = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const response = await fetch(url, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": contentType, "X-Solara-SHA256": sha256 },
    body,
  });
  if (!response.ok) return readError(response);
}

/** Sube el proyecto/sitio staged y confirma el commit atómico en disco. */
export async function saveLocalProject(
  metadata: LocalSaveMetadata,
  projectJson: string | Uint8Array,
  siteMap?: string,
): Promise<LocalSaveReceipt> {
  const started = await requestJson<
    { transactionId: string } & Pick<LocalSaveReceipt, "version" | "folder">
  >("/__solara/storage/saves", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(metadata),
  });
  try {
    const projectBytes =
      typeof projectJson === "string" ? new TextEncoder().encode(projectJson) : projectJson;
    await uploadBytes(
      `/__solara/storage/saves/${encodeURIComponent(started.transactionId)}/project`,
      projectBytes,
      "application/vnd.solara.project+json",
    );
    if (siteMap) {
      await uploadBytes(
        `/__solara/storage/saves/${encodeURIComponent(started.transactionId)}/site`,
        new TextEncoder().encode(siteMap),
        "application/json",
      );
    }
    return await requestJson<LocalSaveReceipt>(
      `/__solara/storage/saves/${encodeURIComponent(started.transactionId)}/commit`,
      { method: "POST", headers: { Accept: "application/json" } },
    );
  } catch (error) {
    await fetch(`/__solara/storage/saves/${encodeURIComponent(started.transactionId)}/abort`, {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => undefined);
    throw error;
  }
}

export async function createLocalManualBackup(
  projectId: string,
): Promise<{ path: string; version: number }> {
  return requestJson(`/__solara/storage/projects/${encodeURIComponent(projectId)}/manual-backup`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
}

export async function openLocalSite(projectId: string): Promise<string> {
  const result = await requestJson<{ url: string }>(
    `/__solara/storage/projects/${encodeURIComponent(projectId)}/open-site`,
    { method: "POST", headers: { Accept: "application/json" } },
  );
  if (!result.url) throw new LocalStorageError("El servidor no devolvió una URL para el sitio.");
  return result.url;
}

export async function openLocalProjectFolder(projectId: string): Promise<{ folder: string }> {
  const result = await requestJson<{ folder?: string }>(
    `/__solara/storage/projects/${encodeURIComponent(projectId)}/open-folder`,
    { method: "POST", headers: { Accept: "application/json" } },
  );
  if (!result.folder)
    throw new LocalStorageError("El servidor no devolvió la carpeta de la tienda.");
  return { folder: result.folder };
}
