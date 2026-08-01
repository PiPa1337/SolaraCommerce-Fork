import { Check, Copy, Image, Trash, UploadSimple, VideoCamera } from "@phosphor-icons/react";
import type { ImageAsset, StoreProjectV1, VideoAsset } from "@solara/project-schema";
import { useEffect, useRef, useState } from "react";
import { Button, EmptyState, InlineError, SectionHeader } from "../components/Ui";
import { bytesToSize } from "../lib/format";
import {
  ASSET_CACHE_RECIPE_VERSION,
  clearAssetCache,
  getCachedAsset,
  getStorageEstimate,
  putCachedAsset,
  requestPersistentStorage,
} from "../lib/repository";
import { hashFile, processImageInWorker } from "../lib/workers";

export function Assets({
  project,
  onChange,
}: {
  project: StoreProjectV1;
  onChange(project: StoreProjectV1): void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [batchStatus, setBatchStatus] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [storage, setStorage] = useState<Awaited<ReturnType<typeof getStorageEstimate>>>();
  const [copied, setCopied] = useState("");

  useEffect(() => {
    void requestPersistentStorage().catch(() => false);
    void getStorageEstimate()
      .then(setStorage)
      .catch(() => undefined);
  }, []);
  const updateAsset = (assetId: ImageAsset["id"], changes: Partial<ImageAsset>) => {
    onChange({
      ...project,
      assets: project.assets.map((asset) =>
        asset.id === assetId ? { ...asset, ...changes } : asset,
      ),
      updatedAt: new Date().toISOString(),
    });
  };

  const updateVideo = (assetId: VideoAsset["id"], changes: Partial<VideoAsset>) => {
    onChange({
      ...project,
      videos: project.videos.map((video) =>
        video.id === assetId ? { ...video, ...changes } : video,
      ),
      updatedAt: new Date().toISOString(),
    });
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(String(reader.result)));
      reader.addEventListener("error", () => reject(new Error("No se pudo leer el video.")));
      reader.readAsDataURL(file);
    });

  const asFileList = (files: File[]): FileList => {
    const transfer = new DataTransfer();
    files.forEach((file) => {
      transfer.items.add(file);
    });
    return transfer.files;
  };

  const addFiles = async (files: FileList) => {
    const selectedFiles = [...files];
    setBusy(true);
    setError("");
    setBatchStatus("");
    setProgress({ current: 0, total: selectedFiles.length });
    try {
      const additions: ImageAsset[] = [];
      const failures: string[] = [];
      const knownHashes = new Set(project.assets.map((asset) => asset.hash).filter(Boolean));
      let duplicates = 0;
      let reused = 0;

      for (const [index, file] of selectedFiles.entries()) {
        try {
          if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            throw new Error("formato no compatible");
          }
          const hash = await hashFile(file);
          if (knownHashes.has(hash)) {
            duplicates += 1;
            continue;
          }
          const cached = await getCachedAsset(hash, ASSET_CACHE_RECIPE_VERSION);
          const processed = cached ?? (await processImageInWorker(file));
          if (!cached) {
            await putCachedAsset({
              hash,
              recipeVersion: ASSET_CACHE_RECIPE_VERSION,
              originalName: file.name,
              mimeType: "image/webp",
              width: processed.width,
              height: processed.height,
              primary: processed.primary,
              fallback: processed.fallback,
              responsive: processed.responsive,
              createdAt: new Date().toISOString(),
            });
          } else {
            reused += 1;
          }
          additions.push({
            kind: "image",
            id: `asset-${crypto.randomUUID()}` as ImageAsset["id"],
            name: file.name.replace(/\.[^.]+$/, ""),
            alt: "",
            mimeType: "image/webp",
            source: processed.primary,
            fallbackSource: processed.fallback,
            responsiveSources: processed.responsive,
            width: processed.width,
            height: processed.height,
            hash,
          });
          knownHashes.add(hash);
        } catch (reason) {
          failures.push(
            `${file.name}: ${reason instanceof Error ? reason.message : "no se pudo procesar"}`,
          );
        } finally {
          setProgress({ current: index + 1, total: selectedFiles.length });
        }
      }
      if (additions.length > 0) {
        onChange({
          ...project,
          assets: [...project.assets, ...additions],
          updatedAt: new Date().toISOString(),
        });
      }
      void getStorageEstimate()
        .then(setStorage)
        .catch(() => undefined);
      const details = [
        `${additions.length} ${additions.length === 1 ? "imagen agregada" : "imágenes agregadas"}`,
        duplicates > 0 ? `${duplicates} duplicadas omitidas` : "",
        reused > 0 ? `${reused} recuperadas de caché` : "",
      ].filter(Boolean);
      setBatchStatus(details.join(" · "));
      if (failures.length > 0) setError(failures.join("\n"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron agregar las imágenes.");
    } finally {
      setBusy(false);
    }
  };

  const addVideos = async (files: FileList) => {
    setBusy(true);
    setError("");
    try {
      const additions: VideoAsset[] = [];
      const knownHashes = new Set(project.videos.map((video) => video.hash));
      for (const file of [...files]) {
        if (!["video/mp4", "video/webm"].includes(file.type))
          throw new Error(`${file.name}: sólo MP4 o WebM.`);
        if (file.size > 30 * 1024 * 1024) throw new Error(`${file.name}: el video supera 30 MB.`);
        const hash = await hashFile(file);
        if (knownHashes.has(hash)) continue;
        const source = await readFileAsDataUrl(file);
        const metadata = await new Promise<{ width: number; height: number; duration: number }>(
          (resolve, reject) => {
            const element = document.createElement("video");
            const objectUrl = URL.createObjectURL(file);
            element.preload = "metadata";
            element.onloadedmetadata = () => {
              URL.revokeObjectURL(objectUrl);
              resolve({
                width: element.videoWidth,
                height: element.videoHeight,
                duration: element.duration,
              });
            };
            element.onerror = () => {
              URL.revokeObjectURL(objectUrl);
              reject(new Error(`${file.name}: no se pudo leer la metadata.`));
            };
            element.src = objectUrl;
          },
        );
        if (
          !Number.isFinite(metadata.width) ||
          !Number.isFinite(metadata.height) ||
          !Number.isFinite(metadata.duration) ||
          metadata.width < 1 ||
          metadata.height < 1 ||
          metadata.duration <= 0 ||
          metadata.duration > 60
        ) {
          throw new Error(`${file.name}: el video debe durar entre 0 y 60 segundos.`);
        }
        additions.push({
          kind: "video",
          id: `video-${crypto.randomUUID()}` as VideoAsset["id"],
          name: file.name.replace(/\.[^.]+$/, ""),
          alt: "",
          mimeType: file.type as "video/mp4" | "video/webm",
          source,
          width: metadata.width,
          height: metadata.height,
          durationSeconds: metadata.duration,
          hash,
        });
        knownHashes.add(hash);
      }
      if (additions.length > 0)
        onChange({
          ...project,
          videos: [...project.videos, ...additions],
          updatedAt: new Date().toISOString(),
        });
      setBatchStatus(
        `${additions.length} ${additions.length === 1 ? "video agregado" : "videos agregados"}`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron agregar los videos.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="workspace-section">
      <SectionHeader
        title="Recursos"
        description="Las imágenes se corrigen, redimensionan y convierten fuera del hilo principal."
        actions={
          <>
            <input
              className="visually-hidden"
              ref={inputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
              onChange={(event) => {
                if (event.target.files) {
                  const selected = [...event.target.files];
                  const images = selected.filter((file) => file.type.startsWith("image/"));
                  const videos = selected.filter((file) => file.type.startsWith("video/"));
                  if (images.length > 0 && videos.length > 0) {
                    setError("Cargá imágenes y videos en tandas separadas para conservar el lote.");
                  } else if (images.length > 0) {
                    void addFiles(asFileList(images));
                  } else if (videos.length > 0) {
                    void addVideos(asFileList(videos));
                  }
                }
                event.target.value = "";
              }}
            />
            <Button
              variant="primary"
              icon={UploadSimple}
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? `Procesando ${progress.current}/${progress.total}` : "Cargar imágenes"}
            </Button>
            <Button
              variant="secondary"
              icon={VideoCamera}
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              Cargar video
            </Button>
          </>
        }
      />
      {error ? <InlineError>{error}</InlineError> : null}
      {batchStatus ? <output>{batchStatus}</output> : null}
      {storage && storage.quota > 0 && storage.ratio >= 0.75 ? (
        <output className="asset-storage-warning">
          El almacenamiento local está al {Math.round(storage.ratio * 100)} % (
          {bytesToSize(storage.usage)} de {bytesToSize(storage.quota)}). Exportá un respaldo y
          limpiá recursos no usados si llega al 90 %.
          <button
            type="button"
            onClick={() => {
              void clearAssetCache()
                .then(() => getStorageEstimate())
                .then(setStorage)
                .catch(() => setError("No se pudo limpiar la caché regenerable."));
            }}
          >
            Limpiar caché regenerable
          </button>
        </output>
      ) : null}
      {project.assets.length === 0 ? (
        <EmptyState
          icon={Image}
          title="No hay imágenes"
          body="Cargá archivos JPG, PNG o WebP. Solara conserva una versión de respaldo por hash."
        />
      ) : (
        <div className="asset-grid">
          {project.assets.map((asset) => (
            <article className="asset-item" key={asset.id}>
              <img
                src={asset.source}
                alt={asset.alt || asset.name}
                width={asset.width}
                height={asset.height}
              />
              <div>
                <label>
                  <span>Nombre</span>
                  <input
                    defaultValue={asset.name}
                    onBlur={(event) => {
                      const name = event.target.value.trim();
                      if (name && name !== asset.name) updateAsset(asset.id, { name });
                    }}
                  />
                </label>
                <label>
                  <span>Texto alternativo</span>
                  <input
                    defaultValue={asset.alt}
                    placeholder="Describí lo visible en la imagen"
                    onBlur={(event) => {
                      const alt = event.target.value.trim();
                      if (alt !== asset.alt) updateAsset(asset.id, { alt });
                    }}
                  />
                </label>
                <span>
                  {asset.width} × {asset.height},{" "}
                  {bytesToSize(Math.round(asset.source.length * 0.75))}
                </span>
                <div className="asset-actions">
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(asset.id).then(() => {
                        setCopied(asset.id);
                        window.setTimeout(() => setCopied(""), 1_200);
                      });
                    }}
                  >
                    {copied === asset.id ? (
                      <Check aria-hidden size={15} />
                    ) : (
                      <Copy aria-hidden size={15} />
                    )}
                    {copied === asset.id ? "Copiado" : "Copiar ID"}
                  </button>
                  <button
                    type="button"
                    disabled={
                      project.products.some((product) => product.imageIds.includes(asset.id)) ||
                      project.videos.some((video) => video.posterAssetId === asset.id) ||
                      project.sections.some((section) =>
                        Object.values(section.settings).includes(asset.id),
                      )
                    }
                    title="Sólo se puede eliminar una imagen que no esté en uso"
                    onClick={() =>
                      onChange({
                        ...project,
                        assets: project.assets.filter((item) => item.id !== asset.id),
                        updatedAt: new Date().toISOString(),
                      })
                    }
                  >
                    <Trash aria-hidden size={15} />
                    Eliminar
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {project.videos.length > 0 ? (
        <div className="asset-grid asset-grid--videos">
          {project.videos.map((video) => (
            <article className="asset-item" key={video.id}>
              <video src={video.source} controls muted width={video.width} height={video.height} />
              <div>
                <label>
                  <span>Nombre</span>
                  <input
                    defaultValue={video.name}
                    onBlur={(event) =>
                      updateVideo(video.id, { name: event.target.value.trim() || video.name })
                    }
                  />
                </label>
                <label>
                  <span>Poster</span>
                  <select
                    defaultValue={video.posterAssetId ?? ""}
                    onChange={(event) =>
                      updateVideo(video.id, {
                        posterAssetId: (event.target.value || undefined) as
                          | ImageAsset["id"]
                          | undefined,
                      })
                    }
                  >
                    <option value="">Seleccionar imagen</option>
                    {project.assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.name}
                      </option>
                    ))}
                  </select>
                </label>
                <span>
                  {video.width} × {video.height}, {Math.round(video.durationSeconds)} s
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
