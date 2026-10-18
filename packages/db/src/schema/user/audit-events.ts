import { sql } from "drizzle-orm"
import {
  check,
  index,
  inet,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core"
import { pk, timestamptz } from "./_helpers.js"

export const auditOutcomeEnum = pgEnum("audit_outcome", ["success", "failure"])
export type AuditOutcome = (typeof auditOutcomeEnum.enumValues)[number]

/**
 * AUDIT_EVENTS: append-only record of every state change and auth outcome (D13).
 * No foreign keys on purpose: audit rows must outlive users and sessions, and the ids are opaque
 * references. No passwords, codes, tokens or raw identifiers of unknown users are ever stored here.
 * (Relations for admin joins: ./relations.ts)
 */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: pk(),
    occurredAt: timestamptz("occurred_at").notNull().defaultNow(),
    // <area>.<action>, e.g. auth.sign_in. Text rather than a pg enum: the list grows, and the closed
    // list lives in packages/contracts.
    eventType: text("event_type").notNull(),
    outcome: auditOutcomeEnum("outcome").notNull(),
    actorUserId: uuid("actor_user_id"),
    subjectUserId: uuid("subject_user_id"),
    sessionId: uuid("session_id"),
    // Hex HMAC-SHA256(AUDIT_HMAC_SECRET, normalized submitted identifier). Throttle and correlation key
    // that also works for unknown identifiers, so limits behave identically for known and unknown
    // accounts (D9, D10). Display masks (a***@mail.com) go in metadata. Never exposed by admin routes.
    identifierHmac: text("identifier_hmac"),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    requestId: text("request_id"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
  },
  (t) => [
    // Indexes are ascending: Postgres scans them backwards for newest-first (AD-4).
    index("audit_events_subject_user_id_occurred_at_idx").on(
      t.subjectUserId,
      t.occurredAt
    ),
    index("audit_events_event_type_occurred_at_idx").on(
      t.eventType,
      t.occurredAt
    ),
    index("audit_events_occurred_at_idx").on(t.occurredAt),
    // AD-4 IP filter and D10 per-IP counts.
    index("audit_events_ip_address_occurred_at_idx")
      .on(t.ipAddress, t.occurredAt)
      .where(sql`${t.ipAddress} is not null`),
    // D10 per-identifier counts.
    index("audit_events_identifier_hmac_occurred_at_idx")
      .on(t.identifierHmac, t.occurredAt)
      .where(sql`${t.identifierHmac} is not null`),
    check(
      "audit_events_event_type_format_chk",
      sql`${t.eventType} ~ '^[a-z_]+[.][a-z_]+$'`
    ),
  ]
)

export type AuditEvent = typeof auditEvents.$inferSelect
export type NewAuditEvent = typeof auditEvents.$inferInsert
