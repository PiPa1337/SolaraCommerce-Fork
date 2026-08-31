import { sha256Hex } from "./pwa.js";

export const MERCHANT_ITEM_GROUP_ID_MAX_LENGTH = 50;

const GENERATED_PREFIX = "solara-";
const HASH_LENGTH = 16;
const READABLE_PREFIX_LENGTH =
  MERCHANT_ITEM_GROUP_ID_MAX_LENGTH - GENERATED_PREFIX.length - HASH_LENGTH - 1;

function readablePrefix(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, READABLE_PREFIX_LENGTH)
    .replace(/-+$/g, "");
}

function hashedId(value: string, attempt = 0): string {
  const hash = sha256Hex(attempt === 0 ? value : `${value}\u0000${attempt}`);
  return `${GENERATED_PREFIX}${hash.slice(0, MERCHANT_ITEM_GROUP_ID_MAX_LENGTH - GENERATED_PREFIX.length)}`;
}

/** Keeps stable Merchant IDs intact and creates deterministic, bounded replacements. */
export function normalizeMerchantId(value: string): string {
  const source = value.trim();
  if (source.length > 0 && source.length <= MERCHANT_ITEM_GROUP_ID_MAX_LENGTH) {
    return source;
  }

  const prefix = readablePrefix(source);
  const hash = sha256Hex(source).slice(0, HASH_LENGTH);
  return `${GENERATED_PREFIX}${prefix ? `${prefix}-` : ""}${hash}`;
}

/** Avoids collisions when legacy IDs differ only by whitespace or a generated suffix. */
export function merchantIdMap(values: Iterable<string>): ReadonlyMap<string, string> {
  const uniqueValues = [...new Set(values)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const result = new Map<string, string>();
  const used = new Map<string, string>();

  for (const value of uniqueValues) {
    let candidate = normalizeMerchantId(value);
    let attempt = 0;
    while (used.has(candidate) && used.get(candidate) !== value) {
      attempt += 1;
      candidate = hashedId(value, attempt);
    }
    result.set(value, candidate);
    used.set(candidate, value);
  }

  return result;
}

export function normalizeMerchantItemGroupId(value: string): string {
  return normalizeMerchantId(value);
}

export function merchantItemGroupIdMap(values: Iterable<string>): ReadonlyMap<string, string> {
  return merchantIdMap(values);
}
