/**
 * Keyset-pagination helpers shared by every `*-options` endpoint (new file, e.g. in @avuny/utils).
 *
 * The cursor is the sort key of the last row returned, base64url-encoded. It is neither secret nor
 * signed: it only means "continue after this row". Tenant scoping stays in the query itself.
 */
import type { z } from "@avuny/zod"

export function encodeCursor(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
}

/** Returns `null` for a missing, malformed or stale cursor, which simply restarts at the first page. */
export function decodeCursor<S extends z.ZodType>(
  token: string | undefined,
  schema: S
): z.infer<S> | null {
  if (!token) return null
  try {
    const json = JSON.parse(Buffer.from(token, "base64url").toString("utf8"))
    const parsed = schema.safeParse(json)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/**
 * Query `limit + 1` rows, then pass them here. The extra row only proves that another page exists:
 * it is dropped, and the last row actually returned becomes the next cursor.
 */
export function toCursorPage<T>(
  rows: T[],
  limit: number,
  cursorOf: (lastRow: T) => unknown
): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const last = items.at(-1)
  return { items, nextCursor: hasMore && last ? encodeCursor(cursorOf(last)) : null }
}
