/**
 * Show a decimal quantity string without padding zeros: "100.000000" -> "100", "2.500000" -> "2.5".
 * Works on the string so no precision is lost. Anything that is not a plain decimal is returned as is.
 */
export function formatQuantity(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "0"
  if (!/^-?\d+(\.\d+)?$/.test(value)) return value
  if (!value.includes(".")) return value
  const trimmed = value.replace(/0+$/, "").replace(/\.$/, "")
  return trimmed === "-0" || trimmed === "" ? "0" : trimmed
}
