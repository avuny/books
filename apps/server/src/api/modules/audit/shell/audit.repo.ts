import { sql } from "@avuny/db"
import type { Database } from "@avuny/db"
import { auditEvents } from "@avuny/db"
import type { WriteAuditEventInput } from "../core/audit.types.js"

/**
 * Wraps an optional IP string for insertion into an `inet` column.
 * Drizzle/postgres.js cannot bind a plain JS string into an inet column directly:
 * the driver treats it as a text parameter and postgres rejects the type mismatch.
 * Using `cast(${val} as inet)` passes the value as a regular bound parameter
 * (injection-safe) and lets postgres perform the cast. Undefined/null → SQL NULL.
 */
function inetParam(ip: string | undefined | null) {
  if (!ip) return null
  return sql`cast(${ip} as inet)`
}

/**
 * Writes a single audit event row.
 *
 * Rules (D13):
 * - Call this inside the same transaction as the state change it records.
 *   For failures, call it standalone.
 * - Never pass passwords, codes, tokens or raw identifiers of unknown users.
 * - audit_events has no foreign keys: rows outlive users, sessions and identifiers.
 *
 * @param db - The database connection or transaction. Pass the transaction instance when
 *   recording an event inside a transaction so it is atomic with the state change.
 */
export async function writeAuditEvent(
  db: Database,
  input: WriteAuditEventInput
): Promise<void> {
  await db.insert(auditEvents).values({
    eventType: input.eventType,
    outcome: input.outcome,
    actorUserId: input.actorUserId,
    subjectUserId: input.subjectUserId,
    sessionId: input.sessionId,
    identifierHmac: input.identifierHmac,
    ipAddress: inetParam(input.ipAddress) as unknown as string | undefined,
    userAgent: input.userAgent,
    requestId: input.requestId,
    metadata: input.metadata ?? {},
  })
}
