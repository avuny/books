import type { ActivityLogAction, ActivityLogResource } from "@avuny/contracts"
import type { Tx } from "@avuny/db"

/**
 * What every module hands to the activity log. This file is the only thing other modules
 * need to import (through index.ts); they never touch the table or the repository.
 */
export interface ActivityLogEntry {
  /** "<resource>.<action>", e.g. "organization_invitation.created". */
  action: ActivityLogAction
  /** What the event is about: "organization_user", "organization_invitation", "role", "organization". Inferred from action if omitted. */
  resource?: ActivityLogResource
  /** The id of the entity the event is about. */
  resourceId: string
  orgId: string
  /** users.id of whoever did it; null for system actions (cron, webhooks). */
  actorId: string | null
  /** Small JSON-safe facts (from/to values, related ids). Never secrets, tokens or dumps of personal data. */
  metadata?: Record<string, unknown>
  /** Pass what the HTTP layer knows; all optional. */
  context?: { requestId?: string; ipAddress?: string; userAgent?: string }

  // Legacy compatibility aliases
  /** @deprecated use action */
  type?: string
  /** @deprecated use resource */
  entityType?: string
  /** @deprecated use resourceId */
  entityId?: string
}

export interface ActivityLogOptions {
  /**
   * Write inside the caller's transaction: the row commits or rolls back together with the
   * business change, and any error propagates to the caller.
   * Without it the write is best-effort (see ActivityLog.log).
   */
  tx?: Tx
}

export interface ActivityLog {
  /**
   * Record one event.
   *
   * - without `opts.tx`: call it AFTER the business change committed. A failure is logged and
   *   swallowed, so a committed change never fails because of its audit row.
   * - with `opts.tx`: atomic; use it when the trail must never miss an event.
   */
  log(entry: ActivityLogEntry, opts?: ActivityLogOptions): Promise<void>
}
