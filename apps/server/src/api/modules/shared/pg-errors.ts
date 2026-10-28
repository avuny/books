/**
 * Skip this file if the server already has an isUniqueViolation helper;
 * just change the import in the two repositories.
 */
type PgLike = { code?: string; constraint?: string; cause?: unknown }

/** Drizzle wraps driver errors (DrizzleQueryError.cause), so unwrap a few levels. */
function unwrap(err: unknown): PgLike | null {
  let cur: unknown = err
  for (let i = 0; i < 3 && cur && typeof cur === "object"; i++) {
    const e = cur as PgLike
    if (typeof e.code === "string") return e
    cur = e.cause
  }
  return null
}

export function isUniqueViolation(
  err: unknown,
  constraint?: string | readonly string[]
): boolean {
  const e = unwrap(err)
  if (!e || e.code !== "23505") return false
  if (!constraint) return true
  const names = typeof constraint === "string" ? [constraint] : constraint
  return !!e.constraint && names.includes(e.constraint)
}

/** 23503: e.g. deleting a role that is still referenced (ON DELETE RESTRICT). */
export function isForeignKeyViolation(err: unknown): boolean {
  return unwrap(err)?.code === "23503"
}
