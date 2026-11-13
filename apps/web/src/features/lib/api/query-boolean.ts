/**
 * Boolean query flags travel as "true" | "false" strings (the contracts validate them that way),
 * so the generated client types them as string unions rather than booleans.
 */
export function toQueryBoolean(value: boolean | undefined): "true" | "false" | undefined {
  return value === undefined ? undefined : value ? "true" : "false"
}
