import { platformAuditEvents, type Database } from "@avuny/db"

export interface PlatformAuditEntry {
  /** NULL for anonymous events (a failed login for an unknown email). */
  adminId: string | null
  /** From PLATFORM_AUDIT_ACTIONS; column format is enforced by a DB check. */
  action: string
  /** Kebab-case resource, e.g. "platform-admin", "platform-admin-session". */
  resource: string
  resourceId?: string | null
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  ipAddress?: string | null
}

/**
 * Append-only audit write (PA-R6). The table rejects UPDATE, DELETE and TRUNCATE
 * at the database level. Never pass secrets, tokens or password hashes (PA-R11).
 * `dbOrTx` accepts a transaction handle so the audit row commits with the action.
 */
export async function writePlatformAudit(
  dbOrTx: Database,
  entry: PlatformAuditEntry
): Promise<void> {
  await dbOrTx.insert(platformAuditEvents).values({
    adminId: entry.adminId,
    action: entry.action,
    resource: entry.resource,
    resourceId: entry.resourceId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    ipAddress: entry.ipAddress ?? null,
  })
}
