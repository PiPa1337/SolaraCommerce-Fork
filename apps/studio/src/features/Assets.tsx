import { Check, Copy, Image, Trash, UploadSimple } from "@phosphor-icons/react";
import type { ImageAsset, StoreProjectV1 } from "@solara/project-schema";
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
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                if (event.target.files) void addFiles(event.target.files);
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
    </section>
  );
}
