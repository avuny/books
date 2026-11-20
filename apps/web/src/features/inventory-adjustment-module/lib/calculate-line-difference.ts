/**
 * Decimal-safe difference calculation for provisional UI display.
 * Returns counted - system as a formatted decimal string (4 decimals).
 */
export function calculateLineDifference(
  counted: string | number | null | undefined,
  system: string | number | null | undefined
): string {
  if (counted === null || counted === undefined || counted === "") {
    return "0.0000"
  }
  const c = Number(counted)
  const s = Number(system ?? 0)

  if (Number.isNaN(c) || Number.isNaN(s)) {
    return "0.0000"
  }

  const diff = c - s
  return diff.toFixed(4)
}
