import type { ImageAsset } from "@solara/project-schema";
import type { ImgHTMLAttributes } from "react";
import { dataUrlMimeType } from "../lib/imageAsset";

type ResponsiveAssetImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "alt" | "sizes" | "src" | "srcSet"
> & {
  asset: ImageAsset;
  alt?: string;
  sizes?: string;
};

/** Usa las variantes del asset en el editor y reserva la fuente principal para tamaños grandes. */
export function ResponsiveAssetImage({
  asset,
  alt,
  sizes,
  ...imageProps
}: ResponsiveAssetImageProps) {
  const sources = new Map<string, Array<{ width: number; source: string }>>();
  for (const source of asset.responsiveSources ?? []) {
    const mimeType = dataUrlMimeType(source.source);
    if (!mimeType) continue;
    const group = sources.get(mimeType) ?? [];
    group.push(source);
    sources.set(mimeType, group);
  }
  const fallbackSource = asset.fallbackSource ?? asset.source;
  const image = (
    <img
      {...imageProps}
      src={fallbackSource}
      alt={(alt ?? asset.alt) || asset.name}
      {...(sizes ? { sizes } : {})}
      decoding={imageProps.decoding ?? "async"}
    />
  );

  if (sources.size === 0) return image;
  return (
    <picture>
      {[...sources.entries()].map(([mimeType, candidates]) => (
        <source
          key={mimeType}
          type={mimeType}
          srcSet={candidates
            .sort((left, right) => left.width - right.width)
            .map((candidate) => `${candidate.source} ${candidate.width}w`)
            .join(", ")}
          {...(sizes ? { sizes } : {})}
        />
      ))}
      {image}
    </picture>
  );
}
