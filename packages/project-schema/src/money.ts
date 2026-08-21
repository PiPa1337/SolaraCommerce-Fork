export type PriceFractionDisplay = "always" | "auto";

/**
 * Formateo visual único para importes en centavos.
 * - cents: entero en centavos (ARS)
 * - priceFractionDisplay: "always" → 2 decimales siempre (comportamiento histórico)
 * - "auto" → 0 decimales si cents % 100 === 0, 2 decimales en otro caso
 * Nunca redondea ni trunca centavos distintos de 00.
 */
export function formatPrice(
  cents: number,
  opts: {
    currency?: string;
    locale?: string;
    priceFractionDisplay?: PriceFractionDisplay;
  } = {},
): string {
  const currency = opts.currency ?? "ARS";
  const locale = opts.locale ?? "es-AR";
  const display = opts.priceFractionDisplay ?? "always";
  if (!Number.isSafeInteger(cents)) {
    throw new Error("El precio debe ser un entero en centavos.");
  }
  const fractionDigits = display === "auto" && cents % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(cents / 100);
}

export function isPriceFractionDisplay(value: unknown): value is PriceFractionDisplay {
  return value === "always" || value === "auto";
}
