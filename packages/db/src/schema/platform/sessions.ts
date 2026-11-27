import { sql } from "drizzle-orm"
import {
  check,
  index,
  inet,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { pk, timestamps, timestamptz } from "../_helpers.js"
import { platformAdmins } from "./admins.js"

/**
 * PLATFORM_ADMIN_SESSIONS: one row per signed-in admin session
 * (PLATFORM-ADMIN-SPEC 3.2). Server-side sessions: 8 hours idle, 7 days absolute,
 * revocable per session. Only the SHA-256 hash of the session token is stored.
 * Separate from tenant `sessions`: a tenant session never authenticates here.
 */
export const platformAdminSessions = pgTable(
  "platform_admin_sessions",
  {
    id: pk(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => platformAdmins.id, { onDelete: "cascade" }),
    // Lowercase hex SHA-256 of the session token.
    tokenHash: text("token_hash").notNull(),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    expiresAt: timestamptz("expires_at").notNull(),
    // Absolute cap: created_at + 7 days, enforced app-side (checks must be immutable).
    revokedAt: timestamptz("revoked_at"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("platform_admin_sessions_token_hash_uidx").on(t.tokenHash),
    index("platform_admin_sessions_admin_id_idx").on(t.adminId),
    index("platform_admin_sessions_expires_at_idx").on(t.expiresAt),
    // Idle expiry is app-side (sliding); a revoked session is dead regardless of expiry.
    check(
      "platform_admin_sessions_expiry_chk",
      sql`${t.expiresAt} > ${t.createdAt}`
    ),
  ]
)

export type PlatformAdminSession = typeof platformAdminSessions.$inferSelect
export type NewPlatformAdminSession = typeof platformAdminSessions.$inferInsert
