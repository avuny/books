import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import type {
  ActivityLogAction,
  ActivityLogResource,
} from "@avuny/contracts"
import { organizations } from "../organization/organizations.js"
import { users } from "../user/users.js"



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

    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),

    // TypeScript enforces the allowed values.
    // PostgreSQL stores them as ordinary text.
    action: text("action").$type<ActivityLogAction>().notNull(),

    resource: text("resource").$type<ActivityLogResource>().notNull(),

    resourceId: uuid("resource_id").notNull(),

    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),

    requestId: varchar("request_id", { length: 64 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("org_activity_logs_org_created_idx").on(
      t.orgId,
      t.createdAt.desc(),
      t.id.desc()
    ),
    index("org_activity_logs_entity_idx").on(
      t.orgId,
      t.resource,
      t.resourceId,
      t.createdAt.desc()
    ),
    index("org_activity_logs_actor_idx").on(
      t.orgId,
      t.actorId,
      t.createdAt.desc()
    ),
  ]
)

export type OrganizationActivityLog = typeof organizationActivityLogs.$inferSelect
export type NewOrganizationActivityLog = typeof organizationActivityLogs.$inferInsert
