/**
 * "0.010000000000" -> "0.01", "1.000000000000" -> "1": the API returns numeric columns
 * padded to their scale. Strings only: never go through JS floats.
 */
export function trimDecimal(value: string): string {
  const [rawInt = "", rawFrac = ""] = value.trim().split(".")
  const int = rawInt.replace(/^0+(?=\d)/, "") || "0"
  const frac = rawFrac.replace(/0+$/, "")
  return frac ? `${int}.${frac}` : int
}
