/**
 * Text inputs hand back "" for empty fields, while the contracts expect `undefined` (optional)
 * or `null` (clear the stored value). These helpers map blanks before validation so the
 * contracts schemas stay the single source of truth.
 */
const isBlank = (value: unknown) => typeof value === "string" && value.trim() === ""

/** Replaces blank strings under `keys` with `replacement`; every other key is untouched. */
export function mapBlanks<T extends Record<string, unknown>>(
  values: T,
  keys: readonly string[],
  replacement: undefined | null
): T {
  const next: Record<string, unknown> = { ...values }
  for (const key of keys) {
    if (isBlank(next[key])) next[key] = replacement
  }
  return next as T
}

/** Number inputs: "" becomes undefined, anything else Number(...). */
export function parseOptionalNumber(raw: string): number | undefined {
  return raw.trim() === "" ? undefined : Number(raw)
}
