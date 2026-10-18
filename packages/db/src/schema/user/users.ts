import { sql } from "drizzle-orm"
import { check, index, pgEnum, pgTable, text } from "drizzle-orm/pg-core"
import { pk, timestamps, timestamptz } from "./_helpers.js"

export const userStatusEnum = pgEnum("user_status", ["active", "suspended"])
export type UserStatus = (typeof userStatusEnum.enumValues)[number]

export const platformRoleEnum = pgEnum("platform_role", [
  "user",
  "support",
  "admin",
])
export type PlatformRole = (typeof platformRoleEnum.enumValues)[number]

/**
 * USERS: platform-level identity (not tenant-scoped). Sign-in identifiers live in user_identifiers.
 * Diff this file against the existing users.ts before applying: keep any extra columns it has.
 * (Relations: ./relations.ts)
 */
export const users = pgTable(
  "users",
  {
    id: pk(),
    name: text("name").notNull(),
    // bcryptjs hash (D6). Never returned by any route, admin routes included (AD-6).
    passwordHash: text("password_hash").notNull(),
    status: userStatusEnum("status").notNull().default("active"),
    // Only the seed script grants support/admin (D12).
    platformRole: platformRoleEnum("platform_role").notNull().default("user"),
    // FileStorage object key (avatars/{userId}/{uuid}.{ext}); the public URL is derived from it.
    avatarKey: text("avatar_key"),
    suspendedAt: timestamptz("suspended_at"),
    suspendedReason: text("suspended_reason"),
    lastSignInAt: timestamptz("last_sign_in_at"),
    // Updated on sign-in and refresh only, never per request.
    lastActiveAt: timestamptz("last_active_at"),
    ...timestamps(),
  },
  (t) => [
    index("users_status_idx").on(t.status),
    index("users_created_at_idx").on(t.createdAt),
    // AC-1: 1-100 characters, no leading or trailing spaces.
    check(
      "users_name_chk",
      sql`char_length(${t.name}) between 1 and 100 and ${t.name} = btrim(${t.name})`
    ),
    // The suspension columns are set exactly when status = 'suspended' (AD-3).
    check(
      "users_suspension_chk",
      sql`(${t.status} = 'suspended' and ${t.suspendedAt} is not null and ${t.suspendedReason} is not null) or (${t.status} = 'active' and ${t.suspendedAt} is null and ${t.suspendedReason} is null)`
    ),
  ]
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
