/** Gestor de media: conserva hashes, metadata y asociación de assets sin bloquear la UI. */
import {
  ArrowsClockwise,
  Check,
  Copy,
  Image,
  Info,
  MagnifyingGlass,
  UploadSimple,
  VideoCamera,
  X,
} from "@phosphor-icons/react";
import type { ImageAsset, StoreProjectV1, VideoAsset } from "@solara/project-schema";
import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ProgressBar } from "../components/primitives";
import { Button, EmptyState, IconButton, InlineError, SectionHeader } from "../components/Ui";
import { assetUses } from "../lib/assetUses";
import { bytesToSize } from "../lib/format";
import { processImageFile } from "../lib/imageUpload";
import { clearAssetCache, getStorageEstimate, requestPersistentStorage } from "../lib/repository";
import { hashFile } from "../lib/workers";
import {
  readFileAsDataUrl,
  readVideoMetadata,
  VIDEO_MAX_BYTES,
  VIDEO_MAX_DURATION_SECONDS,
} from "./builder/videoUpload";

const ASSET_BATCH_SIZE = 24;

export function Assets({
  project,
  onChange,
}: {
  project: StoreProjectV1;
  onChange(project: StoreProjectV1): void;
}) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [assetFailures, setAssetFailures] = useState<Array<{ file: string; message: string }>>([]);
  const [batchStatus, setBatchStatus] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [progressLabel, setProgressLabel] = useState("Procesando imágenes");
  const [storage, setStorage] = useState<Awaited<ReturnType<typeof getStorageEstimate>>>();
  const [cacheBusy, setCacheBusy] = useState(false);
  const [cacheStatus, setCacheStatus] = useState("");
  const [copied, setCopied] = useState("");
  const [copyErrorId, setCopyErrorId] = useState<ImageAsset["id"] | null>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<ImageAsset["id"] | null>(null);
  const selectedAssetOpenerRef = useRef<HTMLElement | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<ImageAsset["id"] | null>(null);
  const [replaceTargetId, setReplaceTargetId] = useState<ImageAsset["id"] | null>(null);
  const [assetQuery, setAssetQuery] = useState("");
  const [visibleAssetCount, setVisibleAssetCount] = useState(ASSET_BATCH_SIZE);

  useEffect(() => {
    void requestPersistentStorage().catch(() => false);
    void getStorageEstimate()
      .then(setStorage)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (selectedAssetId !== null) return;
    const opener = selectedAssetOpenerRef.current;
    selectedAssetOpenerRef.current = null;
    if (!opener?.isConnected) return;
    const frame = window.requestAnimationFrame(() => opener.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [selectedAssetId]);

  const asFileList = (files: File[]): FileList => {
    const transfer = new DataTransfer();
    files.forEach((file) => {
      transfer.items.add(file);
    });
    return transfer.files;
  };

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

  const addFiles = async (files: FileList) => {
    const selectedFiles = [...files];
    setBusy(true);
    setError("");
    setAssetFailures([]);
    setBatchStatus("");
    setProgressLabel("Procesando imágenes");
    setProgress({ current: 0, total: selectedFiles.length });
    try {
      const additions: ImageAsset[] = [];
      const failures: Array<{ file: string; message: string }> = [];
      const knownHashes = new Set(project.assets.map((asset) => asset.hash).filter(Boolean));
      let duplicates = 0;
      let reused = 0;

      for (const [index, file] of selectedFiles.entries()) {
        try {
          const hash = await hashFile(file);
          if (knownHashes.has(hash)) {
            duplicates += 1;
            continue;
          }
          const outcome = await processImageFile(file);
          if (outcome.reused) reused += 1;
          additions.push(outcome.asset);
          knownHashes.add(outcome.asset.hash);
        } catch (reason) {
          failures.push({
            file: file.name,
            message: reason instanceof Error ? reason.message : "no se pudo procesar",
          });
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
        duplicates === 1
          ? "1 duplicada omitida"
          : duplicates > 1
            ? `${duplicates} duplicadas omitidas`
            : "",
        reused === 1 ? "1 recuperada de caché" : reused > 1 ? `${reused} recuperadas de caché` : "",
      ].filter(Boolean);
      setBatchStatus(details.join(" · "));
      if (failures.length > 0) setAssetFailures(failures);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron agregar las imágenes.");
    } finally {
      // Pintar el 100 % antes de liberar la UI: el último setProgress debe
      // commitearse en una tarea propia, o React lo fusiona con setBusy(false)
      // y la barra se oculta sin mostrar el paso final.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      setProgress({ current: selectedFiles.length, total: selectedFiles.length });
      window.setTimeout(() => setBusy(false), 0);
    }
  };

  /** Reemplaza la imagen conservando el ID: todos los usos quedan actualizados. */
  const replaceAsset = async (asset: ImageAsset, file: File) => {
    setBusy(true);
    setError("");
    setAssetFailures([]);
    setBatchStatus("");
    setProgressLabel("Procesando imagen");
    setProgress({ current: 0, total: 1 });
    try {
      const outcome = await processImageFile(file);
      updateAsset(asset.id, {
        mimeType: outcome.asset.mimeType,
        source: outcome.asset.source,
        fallbackSource: outcome.asset.fallbackSource,
        responsiveSources: outcome.asset.responsiveSources,
        width: outcome.asset.width,
        height: outcome.asset.height,
        hash: outcome.asset.hash,
      });
      setProgress({ current: 1, total: 1 });
      setBatchStatus(
        `Imagen reemplazada conservando el ID ${asset.id.slice("asset-".length, "asset-".length + 8)}…`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo reemplazar la imagen.");
    } finally {
      // Dejar pintar el 100 % antes de liberar la UI (ver addFiles).
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      setProgress({ current: 1, total: 1 });
      window.setTimeout(() => setBusy(false), 0);
    }
  };

  const addVideos = async (files: FileList) => {
    const selectedFiles = [...files];
    setBusy(true);
    setError("");
    setAssetFailures([]);
    setBatchStatus("");
    setProgressLabel("Procesando videos");
    setProgress({ current: 0, total: selectedFiles.length });
    try {
      const additions: VideoAsset[] = [];
      const failures: Array<{ file: string; message: string }> = [];
      const knownHashes = new Set(project.videos.map((video) => video.hash));
      let duplicates = 0;

      for (const [index, file] of selectedFiles.entries()) {
        try {
          if (!["video/mp4", "video/webm"].includes(file.type))
            throw new Error("Sólo se aceptan videos MP4 o WebM.");
          if (file.size > VIDEO_MAX_BYTES)
            throw new Error(`El video supera los 30 MB (${bytesToSize(file.size)}).`);
          const hash = await hashFile(file);
          if (knownHashes.has(hash)) {
            duplicates += 1;
            continue;
          }
          const source = await readFileAsDataUrl(file);
          const metadata = await readVideoMetadata(file);
          if (
            !Number.isFinite(metadata.width) ||
            !Number.isFinite(metadata.height) ||
            !Number.isFinite(metadata.duration) ||
            metadata.width < 1 ||
            metadata.height < 1 ||
            metadata.duration <= 0 ||
            metadata.duration > VIDEO_MAX_DURATION_SECONDS
          ) {
            throw new Error("El video debe durar entre 0 y 60 segundos.");
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
        } catch (reason) {
          failures.push({
            file: file.name,
            message: reason instanceof Error ? reason.message : "no se pudo procesar",
          });
        } finally {
          setProgress({ current: index + 1, total: selectedFiles.length });
        }
      }
      if (additions.length > 0)
        onChange({
          ...project,
          videos: [...project.videos, ...additions],
          updatedAt: new Date().toISOString(),
        });
      const details = [
        `${additions.length} ${additions.length === 1 ? "video agregado" : "videos agregados"}`,
        duplicates === 1
          ? "1 duplicado omitido"
          : duplicates > 1
            ? `${duplicates} duplicados omitidos`
            : "",
      ].filter(Boolean);
      setBatchStatus(details.join(" · "));
      if (failures.length > 0) setAssetFailures(failures);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron agregar los videos.");
    } finally {
      // Pintar el 100 % antes de liberar la UI (ver addFiles).
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      setProgress({ current: selectedFiles.length, total: selectedFiles.length });
      window.setTimeout(() => setBusy(false), 0);
    }
  };

  const selectedAsset = project.assets.find((asset) => asset.id === selectedAssetId) ?? null;
  const selectedUses = selectedAsset ? assetUses(project, selectedAsset.id) : [];
  const confirmDeleteAsset = project.assets.find((asset) => asset.id === confirmDeleteId) ?? null;
  const filteredAssets = useMemo(() => {
    const query = assetQuery.trim().toLocaleLowerCase("es");
    if (!query) return project.assets;
    return project.assets.filter((asset) =>
      `${asset.name} ${asset.alt} ${asset.id}`.toLocaleLowerCase("es").includes(query),
    );
  }, [assetQuery, project.assets]);
  const visibleAssets = filteredAssets.slice(0, visibleAssetCount);

  /** Enruta una selección (picker o drop) y reporta archivos no compatibles. */
  const dispatchFiles = (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith("image/"));
    const videos = files.filter((file) => file.type.startsWith("video/"));
    const unsupported = files.filter(
      (file) => !file.type.startsWith("image/") && !file.type.startsWith("video/"),
    );
    if (unsupported.length > 0) {
      setError(
        unsupported.length === 1 && unsupported[0]
          ? `«${unsupported[0].name}» no es un archivo compatible: usá imágenes JPEG, PNG o WebP, o videos MP4 o WebM.`
          : "Algunos archivos no son compatibles: usá imágenes JPEG, PNG o WebP, o videos MP4 o WebM.",
      );
      return;
    }
    if (images.length > 0 && videos.length > 0) {
      setError("Cargá imágenes y videos en tandas separadas para conservar el lote.");
    } else if (images.length > 0) {
      void addFiles(asFileList(images));
    } else if (videos.length > 0) {
      void addVideos(asFileList(videos));
    }
  };

  const handleDragEnter = () => {
    if (busy) return;
    dragDepthRef.current += 1;
    setDragging(true);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = () => {
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setDragging(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepthRef.current = 0;
    setDragging(false);
    if (busy) return;
    const dropped = [...event.dataTransfer.files];
    if (dropped.length === 0) return;
    dispatchFiles(dropped);
  };

  const clearRegenerableCache = () => {
    setCacheBusy(true);
    setCacheStatus("Limpiando caché regenerable…");
    void clearAssetCache()
      .then(() => getStorageEstimate())
      .then((nextStorage) => {
        setStorage(nextStorage);
        setCacheStatus("Caché regenerable limpiada.");
      })
      .catch(() => {
        setCacheStatus("");
        setError("No se pudo limpiar la caché regenerable.");
      })
      .finally(() => setCacheBusy(false));
  };

  const openReplacePicker = (asset: ImageAsset) => {
    setReplaceTargetId(asset.id);
    imageInputRef.current?.click();
  };

  const openAssetDetail = (assetId: ImageAsset["id"]) => {
    selectedAssetOpenerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedAssetId(assetId);
  };

  const copyAssetId = async (assetId: ImageAsset["id"]) => {
    setCopyErrorId(null);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(assetId);
      setCopied(assetId);
      window.setTimeout(() => setCopied(""), 1_200);
    } catch {
      setCopied("");
      setCopyErrorId(assetId);
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
              ref={imageInputRef}
              type="file"
              aria-label="Seleccionar imágenes"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                if (replaceTargetId) {
                  const file = event.target.files?.[0];
                  const target = project.assets.find((asset) => asset.id === replaceTargetId);
                  if (file && target) void replaceAsset(target, file);
                  setReplaceTargetId(null);
                } else if (event.target.files) {
                  dispatchFiles([...event.target.files]);
                }
                event.target.value = "";
              }}
            />
            <input
              className="visually-hidden"
              ref={videoInputRef}
              type="file"
              aria-label="Seleccionar videos"
              multiple
              accept="video/mp4,video/webm"
              onChange={(event) => {
                if (event.target.files) void addVideos(event.target.files);
                event.target.value = "";
              }}
            />
            <Button
              variant="primary"
              icon={UploadSimple}
              disabled={busy}
              data-testid="ui-asset-upload"
              onClick={() => {
                setReplaceTargetId(null);
                imageInputRef.current?.click();
              }}
            >
              {busy ? `Procesando ${progress.current}/${progress.total}` : "Cargar imágenes"}
            </Button>
            <Button
              variant="secondary"
              icon={VideoCamera}
              disabled={busy}
              onClick={() => videoInputRef.current?.click()}
            >
              Cargar video
            </Button>
          </>
        }
      />
      {/* biome-ignore lint/a11y/noStaticElementInteractions: zona de drop pasiva; el acceso por teclado y el foco usan los botones de carga de la cabecera. */}
      <div
        className={`asset-dropzone${dragging ? " asset-dropzone--active" : ""}`}
        data-testid="ui-assets-dropzone"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {dragging ? (
          <output className="export-progress" data-testid="ui-assets-drop-hint">
            Soltá imágenes o videos para cargarlos
          </output>
        ) : null}
        {busy && progress.total > 0 ? (
          <div data-testid="ui-assets-progress" aria-live="polite">
            <ProgressBar value={progress.current} max={progress.total} label={progressLabel} />
            <output className="export-progress">
              Procesando {progress.current}/{progress.total} ·{" "}
              {Math.round((progress.current / progress.total) * 100)}%
            </output>
          </div>
        ) : null}
        {error ? <InlineError>{error}</InlineError> : null}
        {assetFailures.length > 0 ? (
          <div className="asset-errors" data-testid="ui-asset-errors">
            <p className="asset-errors__title">Estos archivos no se agregaron:</p>
            <ul>
              {assetFailures.map((failure, index) => (
                <li
                  className="asset-error-item"
                  data-testid="ui-asset-error"
                  key={`${failure.file}-${index}`}
                >
                  <strong>{failure.file}</strong>: {failure.message}
                </li>
              ))}
            </ul>
            <p className="asset-errors__hint">
              Usá imágenes JPEG, PNG o WebP de hasta 25 MB o videos MP4 o WebM de hasta 30 MB; el
              resto del lote se conservó.
            </p>
          </div>
        ) : null}
        {batchStatus ? <output data-testid="ui-asset-batch-status">{batchStatus}</output> : null}
        {storage && storage.quota > 0 && storage.ratio >= 0.75 ? (
          <output className="asset-storage-warning" aria-live="polite">
            El almacenamiento local está al {Math.round(storage.ratio * 100)} % (
            {bytesToSize(storage.usage)} de {bytesToSize(storage.quota)}). Exportá un respaldo y
            limpiá recursos no usados si llega al 90 %.
            <button
              type="button"
              disabled={cacheBusy}
              aria-busy={cacheBusy}
              onClick={clearRegenerableCache}
            >
              {cacheBusy ? "Limpiando…" : "Limpiar caché regenerable"}
            </button>
          </output>
        ) : null}
        {cacheStatus ? (
          <output
            className="asset-cache-status"
            data-testid="ui-asset-cache-status"
            aria-live="polite"
          >
            {cacheStatus}
          </output>
        ) : null}
        {selectedAsset ? (
          <aside
            className="audit-panel"
            data-testid="ui-asset-detail"
            aria-label={`Detalle de ${selectedAsset.name}`}
          >
            <header>
              <div>
                <h3>{selectedAsset.name}</h3>
                <p>
                  {selectedAsset.width} × {selectedAsset.height} ·{" "}
                  {bytesToSize(Math.round(selectedAsset.source.length * 0.75))} · hash{" "}
                  {selectedAsset.hash.slice(0, 8)}…
                </p>
                <p data-testid="ui-asset-id">
                  ID: <code>{selectedAsset.id}</code>
                </p>
              </div>
              <IconButton
                icon={X}
                label="Cerrar detalle"
                data-testid="ui-asset-detail-close"
                onClick={() => setSelectedAssetId(null)}
              />
            </header>
            <div className="audit-list">
              {selectedUses.length === 0 ? (
                <div className="audit-item" data-testid="ui-asset-uses">
                  <Check aria-hidden size={18} />
                  <div>
                    <strong>Sin usos</strong>
                    <p>Esta imagen no está asignada a ningún producto, categoría ni sección.</p>
                  </div>
                </div>
              ) : (
                selectedUses.map((use, index) => (
                  <div
                    className="audit-item"
                    data-testid="ui-asset-use"
                    key={`${use.label}-${index}`}
                  >
                    <Image aria-hidden size={18} />
                    <div>
                      <strong>{use.label}</strong>
                      <p>{use.detail}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="export-actions">
              <Button
                icon={ArrowsClockwise}
                disabled={busy}
                data-testid="ui-asset-replace"
                onClick={() => openReplacePicker(selectedAsset)}
              >
                Reemplazar imagen
              </Button>
              <Button
                variant="danger"
                disabled={busy || selectedUses.length > 0}
                title={
                  selectedUses.length > 0
                    ? "Sólo se puede eliminar una imagen que no esté en uso"
                    : undefined
                }
                data-testid="ui-asset-delete"
                onClick={() => setConfirmDeleteId(selectedAsset.id)}
              >
                Eliminar
              </Button>
            </div>
          </aside>
        ) : null}
        {project.assets.length > 0 ? (
          <div className="asset-library-toolbar">
            <label className="search-box">
              <MagnifyingGlass aria-hidden size={17} />
              <span className="visually-hidden">Buscar recursos</span>
              <input
                type="search"
                value={assetQuery}
                placeholder="Buscar por nombre, texto alternativo o ID"
                onChange={(event) => {
                  setAssetQuery(event.target.value);
                  setVisibleAssetCount(ASSET_BATCH_SIZE);
                }}
              />
            </label>
            <output aria-live="polite">
              {visibleAssets.length} de {filteredAssets.length} imágenes
            </output>
          </div>
        ) : null}
        {project.assets.length === 0 ? (
          <EmptyState
            icon={Image}
            title="No hay imágenes"
            body="Cargá archivos JPG, PNG o WebP. Solara conserva una versión de respaldo por hash."
            action={
              <Button
                variant="primary"
                icon={UploadSimple}
                disabled={busy}
                onClick={() => imageInputRef.current?.click()}
              >
                Cargar imágenes
              </Button>
            }
          />
        ) : filteredAssets.length === 0 ? (
          <EmptyState
            icon={MagnifyingGlass}
            title="No encontramos recursos"
            body="Probá con otro nombre, texto alternativo o ID."
            action={
              <Button
                variant="quiet"
                onClick={() => {
                  setAssetQuery("");
                  setVisibleAssetCount(ASSET_BATCH_SIZE);
                }}
              >
                Limpiar búsqueda
              </Button>
            }
          />
        ) : (
          <>
            <div className="asset-grid">
              {visibleAssets.map((asset) => (
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
                        key={`${asset.id}-${asset.hash}`}
                        defaultValue={asset.name}
                        aria-description={`Recurso ${asset.name}`}
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
                        aria-description={`Recurso ${asset.name}`}
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
                        aria-label={`Detalle de ${asset.name}`}
                        data-testid="ui-asset-detail-open"
                        onClick={() => openAssetDetail(asset.id)}
                      >
                        <Info aria-hidden size={15} />
                        Detalle
                      </button>
                      <button
                        type="button"
                        aria-label={`${copied === asset.id ? "Copiado" : "Copiar ID"} de ${asset.name}`}
                        onClick={() => void copyAssetId(asset.id)}
                      >
                        {copied === asset.id ? (
                          <Check aria-hidden size={15} />
                        ) : (
                          <Copy aria-hidden size={15} />
                        )}
                        {copied === asset.id ? "Copiado" : "Copiar ID"}
                      </button>
                      {copyErrorId === asset.id ? (
                        <small
                          className="field-error"
                          role="alert"
                          data-testid="ui-asset-copy-error"
                        >
                          No se pudo copiar el ID. Podés seleccionarlo manualmente desde el detalle.
                        </small>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {visibleAssets.length < filteredAssets.length ? (
              <div className="asset-library-more">
                <Button
                  variant="quiet"
                  onClick={() =>
                    setVisibleAssetCount((current) =>
                      Math.min(current + ASSET_BATCH_SIZE, filteredAssets.length),
                    )
                  }
                >
                  Mostrar {Math.min(ASSET_BATCH_SIZE, filteredAssets.length - visibleAssets.length)}
                  más
                </Button>
                <span>{filteredAssets.length - visibleAssets.length} pendientes</span>
              </div>
            ) : null}
          </>
        )}
        {project.videos.length > 0 ? (
          <div className="asset-grid asset-grid--videos">
            {project.videos.map((video) => (
              <article className="asset-item" key={video.id}>
                <video
                  src={video.source}
                  controls
                  muted
                  width={video.width}
                  height={video.height}
                />
                <div>
                  <label>
                    <span>Nombre</span>
                    <input
                      defaultValue={video.name}
                      aria-description={`Video ${video.name}`}
                      onBlur={(event) =>
                        updateVideo(video.id, { name: event.target.value.trim() || video.name })
                      }
                    />
                  </label>
                  <label>
                    <span>Imagen de portada</span>
                    <select
                      defaultValue={video.posterAssetId ?? ""}
                      aria-description={`Video ${video.name}`}
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
      </div>
      {confirmDeleteAsset ? (
        <ConfirmDialog
          title="Eliminar imagen"
          danger
          confirmLabel="Eliminar"
          body={
            <p>
              Se eliminará la imagen «{confirmDeleteAsset.name}» del proyecto. Los respaldos y el
              sitio exportado conservan sus propias copias.
            </p>
          }
          onConfirm={() => {
            onChange({
              ...project,
              assets: project.assets.filter((item) => item.id !== confirmDeleteAsset.id),
              updatedAt: new Date().toISOString(),
            });
            setConfirmDeleteId(null);
            setSelectedAssetId(null);
          }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      ) : null}
    </section>
  );
}
