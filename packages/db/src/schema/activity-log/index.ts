import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import {
  ACTIVITY_LOG_ACTIONS,
  ACTIVITY_LOG_RESOURCES,
} from "@avuny/contracts"
import { organizations } from "../organization/organizations.js"
import { users } from "../user/users.js"

export const activityLogResourceEnum = pgEnum(
  "activity_log_resource",
  ACTIVITY_LOG_RESOURCES
)

export const activityLogActionEnum = pgEnum(
  "activity_log_action",
  ACTIVITY_LOG_ACTIONS
)

export type ActivityLogResource = (typeof activityLogResourceEnum.enumValues)[number]
export type ActivityLogAction = (typeof activityLogActionEnum.enumValues)[number]

/**
 * Append-only audit trail for everything that happens inside an organization.
 *
 * One row per event. Modules write through the `ActivityLog` port (never straight to this
 * table) and the application never UPDATEs or DELETEs rows.
 *
 * ASSUMPTIONS, adjust to your schema: `organizations.id` and `users.id` are uuids, and
 * every entity id you log is a uuid. If some are not, change `entityId` to a varchar.
 */
export const organizationActivityLogs = pgTable(
  "organization_activity_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    /** users.id of whoever did it. Null = the system (cron, webhook) or a since-deleted user. */
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),

    /** "<resource>.<action>", e.g. "organization_user.username_changed". */
    action: activityLogActionEnum("action").notNull(),

    /** What the event is about: "organization_user", "organization_invitation", "invoice"... */
    resource: activityLogResourceEnum("resource").notNull(),
    resourceId: uuid("resource_id").notNull(),

    /** Small JSON-safe facts (from/to values, related ids). Never secrets or tokens. */
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),

    /** Request context, kept for forensics. Not exposed through the DTO. */
    requestId: varchar("request_id", { length: 64 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The main feed: newest first inside an organization.
    index("org_activity_logs_org_created_idx").on(t.orgId, t.createdAt.desc(), t.id.desc()),
    // "History of this record".
    index("org_activity_logs_entity_idx").on(
      t.orgId,
      t.resource,
      t.resourceId,
      t.createdAt.desc()
    ),
    // "Everything this person did".
    index("org_activity_logs_actor_idx").on(t.orgId, t.actorId, t.createdAt.desc()),
  ]
)

export type OrganizationActivityLog = typeof organizationActivityLogs.$inferSelect
export type NewOrganizationActivityLog = typeof organizationActivityLogs.$inferInsert
