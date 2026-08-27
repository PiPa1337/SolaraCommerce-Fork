import { UploadSimple } from "@phosphor-icons/react";
import type { ImageAsset } from "@solara/project-schema";
import { useRef, useState } from "react";
import { IMAGE_UPLOAD_ACCEPT, processImageFile } from "../lib/imageUpload";
import { Button, InlineError } from "./Ui";

export function ImageUploadButton({
  assets,
  onUpload,
  processFile,
  disabled = false,
  label = "Subir imagen",
}: {
  assets: readonly ImageAsset[];
  onUpload(asset: ImageAsset): void;
  processFile?: (file: File) => Promise<ImageAsset>;
  disabled?: boolean;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (!IMAGE_UPLOAD_ACCEPT.split(",").includes(file.type)) {
        throw new Error("Sólo se aceptan imágenes JPEG, PNG o WebP.");
      }
      const asset = processFile ? await processFile(file) : (await processImageFile(file)).asset;
      const existing = assets.find((candidate) => candidate.hash === asset.hash);
      onUpload(existing ?? asset);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo subir la imagen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="image-upload-control">
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_UPLOAD_ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void handleFile(file);
        }}
      />
      <Button
        variant="quiet"
        icon={UploadSimple}
        disabled={disabled || busy}
        loading={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Procesando imagen…" : label}
      </Button>
      {error ? <InlineError>{error}</InlineError> : null}
    </div>
  );
}

export function ImageAssetPicker({
  value,
  assets,
  knownAssets,
  onChange,
  onUpload,
  processFile,
  disabled = false,
  noneLabel = "Sin imagen",
  ariaLabel,
}: {
  value: string;
  assets: readonly ImageAsset[];
  knownAssets?: readonly ImageAsset[];
  onChange(value: string): void;
  onUpload?: (asset: ImageAsset) => void;
  processFile?: (file: File) => Promise<ImageAsset>;
  disabled?: boolean;
  noneLabel?: string;
  ariaLabel?: string;
}) {
  return (
    <div className="image-asset-picker-control">
      <select
        value={value}
        disabled={disabled}
        {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{noneLabel}</option>
        {assets.map((asset) => (
          <option key={asset.id} value={asset.id}>
            {asset.name}
          </option>
        ))}
      </select>
      {onUpload ? (
        <ImageUploadButton
          assets={knownAssets ?? assets}
          onUpload={onUpload}
          {...(processFile ? { processFile } : {})}
          disabled={disabled}
        />
      ) : null}
    </div>
  );
}
