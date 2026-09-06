/**
 * Bóveda de recuperación flaca (`solara-recovery/`).
 *
 * La bóveda trae CERO bytes de imagen/video: cada `source` publicado se
 * reemplaza por `solara-ref:<id>` y al recuperar se rehidrata descargando el
 * archivo ya publicado del propio sitio. Lo no publicado (fuera de
 * `publicMediaUsage`) se elimina y se lista en `missing` con sus `usedBy`.
 *
 * Este módulo es puro y síncrono a propósito: no hashea (el worker usa
 * `crypto.subtle`), no comprime y no toca el mapa de archivos. Solo
 * transforma proyectos entre forma editable y forma flaca.
 */

import type { StoreProjectV1 } from "@solara/project-schema";
import { StoreProjectV2Schema } from "@solara/project-schema";

export const RECOVERY_ROOT = "solara-recovery";
export const RECOVERY_MANIFEST_NAME = "manifest.json";
export const RECOVERY_SLIM_NAME = "slim.json.gz";
export const RECOVERY_ASSETS_NAME = "assets.json";
/** Tope de peso extra del sitio: la bóveda completa debe entrar acá. */
export const RECOVERY_MAX_BYTES = 2 * 1024 * 1024;
/** Marca de referencia a un asset publicado. Nunca colisiona con `data:`. */
export const REF_PREFIX = "solara-ref:";

export interface RecoveryAssetRef {
  id: string;
  kind: "image" | "video";
  /** Ruta exacta del archivo en el sitio (existe en el mapa exportado). */
  file: string;
  mimeType: string;
  hash: string;
  width?: number;
  height?: number;
}

export interface RecoveryMissing {
  kind: "image" | "video";
  assetId: string;
  /** Rutas JSON donde se referenciaba (vacío si nadie lo usaba). */
  usedBy: string[];
}

export interface RecoveryManifest {
  format: "solara-recovery";
  version: 1;
  projectId: string;
  exportedAt: string;
  schemaVersion: 2;
  templateVersion: number;
  rendererFingerprint: string | null;
  /** Pathname base del sitio ("" o "/tienda"): para resolver /assets. */
  assetBasePath: string;
  /** Rutas relativas a la raíz del sitio. */
  slimFile: string;
  assetsFile: string;
  slimSha256: string;
  slimGzipBytes: number;
  slimRawBytes: number;
  assetsSha256: string;
  coverage: "published-only";
  missing: RecoveryMissing[];
}

export interface MediaUsage {
  assetIds: ReadonlySet<string>;
  videoIds: ReadonlySet<string>;
}

export interface SlimResult {
  slimProject: StoreProjectV1;
  missing: RecoveryMissing[];
}

/** Construye el índice pequeño que permite descargar los medios publicados. */
export function buildRecoveryAssetRefs(
  project: StoreProjectV1,
  used: MediaUsage,
  paths: ReadonlyMap<string, string>,
  sourceHashes: ReadonlyMap<string, string> = new Map(),
): RecoveryAssetRef[] {
  return entitiesOf(project)
    .filter((entity) => {
      const included =
        entity.kind === "video" ? used.videoIds.has(entity.id) : used.assetIds.has(entity.id);
      return included && /^data:/i.test(entity.source);
    })
    .map((entity) => {
      const file = paths.get(entity.id);
      if (!file) {
        throw new Error(`No se pudo resolver el archivo público del recurso ${entity.id}.`);
      }
      const hash = sourceHashes.get(entity.id) ?? entity.hash;
      if (!hash) throw new Error(`El recurso ${entity.id} no tiene hash.`);
      return {
        id: entity.id,
        kind: entity.kind === "video" ? "video" : "image",
        file,
        mimeType: entity.mimeType,
        hash,
        ...(entity.width !== undefined ? { width: entity.width } : {}),
        ...(entity.height !== undefined ? { height: entity.height } : {}),
      } satisfies RecoveryAssetRef;
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

/** `solara-recovery/<64 hex>`: azar criptográfico, único por exportación. */
export function newRecoveryDir(randomBytes?: Uint8Array): string {
  const bytes = randomBytes ?? crypto.getRandomValues(new Uint8Array(32));
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${RECOVERY_ROOT}/${hex}`;
}

export function recoveryFileList(dir: string): {
  manifest: string;
  slim: string;
  assets: string;
} {
  return {
    manifest: `${dir}/${RECOVERY_MANIFEST_NAME}`,
    slim: `${dir}/${RECOVERY_SLIM_NAME}`,
    assets: `${dir}/${RECOVERY_ASSETS_NAME}`,
  };
}

export function parseRecoveryManifest(raw: unknown): RecoveryManifest {
  const manifest = raw as Partial<RecoveryManifest> | null | undefined;
  if (
    !manifest ||
    manifest.format !== "solara-recovery" ||
    manifest.version !== 1 ||
    typeof manifest.projectId !== "string" ||
    typeof manifest.exportedAt !== "string" ||
    manifest.schemaVersion !== 2 ||
    typeof manifest.templateVersion !== "number" ||
    typeof manifest.assetBasePath !== "string" ||
    typeof manifest.slimFile !== "string" ||
    typeof manifest.assetsFile !== "string" ||
    !/^[0-9a-f]{64}$/i.test(manifest.slimSha256 ?? "") ||
    typeof manifest.slimGzipBytes !== "number" ||
    typeof manifest.slimRawBytes !== "number" ||
    !/^[0-9a-f]{64}$/i.test(manifest.assetsSha256 ?? "") ||
    manifest.coverage !== "published-only" ||
    !Array.isArray(manifest.missing)
  ) {
    throw new Error(
      "Este sitio no incluye una bóveda de recuperación compatible con esta versión de SolaraCommerce.",
    );
  }
  return manifest as RecoveryManifest;
}

/**
 * Claves de objeto que guardan IDs de medios. Cubre `imageId`,
 * `posterAssetId`, `videoAssetId`, `logoAssetId`, `faviconAssetId`,
 * `socialImageId`, `imageAssetId`, `backgroundImageId` y futuras
 * `*ImageId`/`*AssetId` sin acoplar al scan por definiciones de módulos.
 */
const MEDIA_KEY =
  /(imageid|assetid|posterassetid|videoassetid|logoassetid|faviconassetid|socialimageid)$/;

function mediaKeyName(key: string): boolean {
  return MEDIA_KEY.test(key.toLowerCase().replace(/[^a-z]/g, ""));
}

interface MediaEntity {
  id: string;
  kind: string;
  source: string;
  mimeType: string;
  hash?: string;
  width?: number;
  height?: number;
}

function entitiesOf(project: StoreProjectV1): MediaEntity[] {
  return [...project.assets, ...project.videos] as MediaEntity[];
}

/**
 * Limpia del objeto toda referencia a IDs descartados y registra dónde
 * estaba cada una. Solo actúa ante igualdad exacta con un ID descartado:
 * elementos de arrays (se eliminan) y propiedades con clave de medios (se
 * borran). El prose nunca puede igualar exactamente un ID de asset.
 */
function sweepDroppedReferences(
  node: unknown,
  path: string,
  dropped: ReadonlySet<string>,
  usedBy: Map<string, string[]>,
): void {
  if (Array.isArray(node)) {
    for (let index = node.length - 1; index >= 0; index -= 1) {
      const value = node[index];
      const itemPath = `${path}[${index}]`;
      if (typeof value === "string" && dropped.has(value)) {
        node.splice(index, 1);
        const list = usedBy.get(value) ?? [];
        list.push(itemPath);
        usedBy.set(value, list);
      } else {
        sweepDroppedReferences(value, itemPath, dropped, usedBy);
      }
    }
    return;
  }
  if (node !== null && typeof node === "object") {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const childPath = path ? `${path}.${key}` : key;
      if (typeof value === "string" && dropped.has(value) && mediaKeyName(key)) {
        delete (node as Record<string, unknown>)[key];
        const list = usedBy.get(value) ?? [];
        list.push(childPath);
        usedBy.set(value, list);
      } else {
        sweepDroppedReferences(value, childPath, dropped, usedBy);
      }
    }
  }
}

/**
 * Convierte el proyecto a forma flaca: `source` data: publicados → refs,
 * derivados (`fallbackSource`, `responsiveSources`) eliminados (se
 * re-derivan al re-guardar), entidades data: no usadas eliminadas y
 * listadas. Las sources http(s) se conservan verbatim (no pesan).
 *
 * Valida el resultado contra el schema: cualquier referencia colgante que
 * el barrido haya pasado por alto falla acá con su ruta, nunca en el
 * sitio del usuario.
 */
export function splitSlimProject(project: StoreProjectV1, used: MediaUsage): SlimResult {
  const slimProject = structuredClone(project);
  const dropped = new Set<string>();

  for (const entity of entitiesOf(slimProject)) {
    if (!/^data:/i.test(entity.source)) continue;
    const isUsed =
      entity.kind === "video" ? used.videoIds.has(entity.id) : used.assetIds.has(entity.id);
    if (isUsed) {
      entity.source = `${REF_PREFIX}${entity.id}`;
      if (entity.kind === "image") {
        delete (entity as unknown as Record<string, unknown>).fallbackSource;
        delete (entity as unknown as Record<string, unknown>).responsiveSources;
      }
    } else {
      dropped.add(entity.id);
    }
  }

  const usedBy = new Map<string, string[]>();
  sweepDroppedReferences(slimProject, "", dropped, usedBy);

  slimProject.assets = slimProject.assets.filter((asset) => !dropped.has(asset.id));
  slimProject.videos = slimProject.videos.filter((video) => !dropped.has(video.id));

  const missing: RecoveryMissing[] = [];
  for (const entity of entitiesOf(project)) {
    if (!dropped.has(entity.id)) continue;
    missing.push({
      kind: entity.kind === "video" ? "video" : "image",
      assetId: entity.id,
      usedBy: [...(usedBy.get(entity.id) ?? [])].sort(),
    });
  }
  const parsed = StoreProjectV2Schema.safeParse(slimProject);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".") || "project";
    throw new Error(
      `La bóveda quedó inválida al adelgazar el proyecto (${path}: ${issue?.message ?? "validación fallida"}).`,
    );
  }
  return { slimProject: parsed.data as StoreProjectV1, missing };
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
  }
  let binary = "";
  const stride = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += stride) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + stride));
  }
  return btoa(binary);
}

/**
 * Inverso de la sustitución: cada `solara-ref:<id>` vuelve a su data URL
 * con los bytes aportados. Lanza nombrando el id si falta un blob.
 */
export function restoreAssetSources(
  slimProject: StoreProjectV1,
  blobs: ReadonlyMap<string, { bytes: Uint8Array; mimeType: string }>,
): StoreProjectV1 {
  const restored = structuredClone(slimProject);
  for (const entity of entitiesOf(restored)) {
    if (!entity.source.startsWith(REF_PREFIX)) continue;
    const id = entity.source.slice(REF_PREFIX.length);
    const blob = blobs.get(id);
    if (!blob) {
      throw new Error(
        `Falta el recurso ${id} para restaurar la tienda. La bóveda está incompleta.`,
      );
    }
    entity.source = `data:${blob.mimeType};base64,${bytesToBase64(blob.bytes)}`;
  }
  return restored;
}
