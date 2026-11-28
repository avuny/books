import { sql } from "drizzle-orm"
import { check, index, inet, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core"
import { matchesRegex, pk, timestamptz } from "../_helpers.js"

/**
 * PLATFORM_AUDIT_EVENTS: append-only record of every platform action with before and
 * after (PA-R6, PLATFORM-ADMIN-SPEC 3.1). No foreign keys on purpose: audit rows must
 * outlive admins, sessions and invites, and the ids are opaque references.
 *
 * Append-only is enforced in the database by the `platform_audit_events_append_only`
 * triggers installed by the platform identity migrations: UPDATE, DELETE and TRUNCATE raise.
 * The spec's `at` column is named `occurred_at` here, matching tenant `audit_events`.
 * No secrets, tokens or password hashes are ever stored (PA-R11).
 */
export const platformAuditEvents = pgTable(
  "platform_audit_events",
  {
    id: pk(),
    occurredAt: timestamptz("occurred_at").notNull().defaultNow(),
    // NULL for anonymous events (failed login for an unknown email) and the bootstrap CLI.
    adminId: uuid("admin_id"),
    // What happened, snake_case verb: `created`, `published`, `login_failed`, ...
    action: text("action").notNull(),
    // What it happened to, kebab-case resource: `platform-plan`, `platform-admin`, ...
    resource: text("resource").notNull(),
    resourceId: text("resource_id"),
    before: jsonb("before").$type<Record<string, unknown>>(),
    after: jsonb("after").$type<Record<string, unknown>>(),
    ipAddress: inet("ip_address"),
  },
  (t) => [
    index("platform_audit_events_admin_id_occurred_at_idx").on(
      t.adminId,
      t.occurredAt
    ),
    index("platform_audit_events_resource_occurred_at_idx").on(
      t.resource,
      t.resourceId,
      t.occurredAt
    ),
    index("platform_audit_events_occurred_at_idx").on(t.occurredAt),
    check(
      "platform_audit_events_action_format_chk",
      matchesRegex(t.action, "^[a-z][a-z0-9_.]*$")
    ),
    check(
      "platform_audit_events_resource_format_chk",
      matchesRegex(t.resource, "^[a-z][a-z0-9-]*$")
    ),
  ]
)

export type PlatformAuditEvent = typeof platformAuditEvents.$inferSelect
export type NewPlatformAuditEvent = typeof platformAuditEvents.$inferInsert
