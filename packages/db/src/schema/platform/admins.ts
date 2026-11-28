import { sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core"
import {
  isNormalized,
  pk,
  timestamps,
  timestamptz,
} from "../_helpers.js"

export const platformAdminStatusEnum = pgEnum("platform_admin_status", [
  "invited",
  "active",
  "disabled",
])
export type PlatformAdminStatus =
  (typeof platformAdminStatusEnum.enumValues)[number]

/**
 * PLATFORM_ADMINS: back-office identity, fully separate from tenant `users`
 * (PLATFORM-ADMIN-SPEC 3.1). No registration exists: rows are created by the
 * bootstrap CLI or by accepting an invite (`platform_invites`).
 * - `password_hash` is a bcryptjs hash, same as tenant users. Never returned (PA-R11).
 * - `totp_secret_enc` is the TOTP secret encrypted at rest; TOTP is mandatory (Q16),
 *   so `invited` becomes `active` exactly when the first TOTP enrollment verifies.
 * - Admins are disabled, never deleted (audit history must survive).
 */
export const platformAdmins = pgTable(
  "platform_admins",
  {
    id: pk(),
    // Trimmed + lowercase, enforced by the check below (writes normalize app-side).
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    status: platformAdminStatusEnum("status").notNull().default("invited"),
    totpSecretEnc: text("totp_secret_enc"),
    totpEnabledAt: timestamptz("totp_enabled_at"),
    lastLoginAt: timestamptz("last_login_at"),
    // Lockout (PA login rules): 5 failed attempts lock for 15 minutes.
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: timestamptz("locked_until"),
    // NULL for the bootstrap admin created by the CLI.
    createdBy: uuid("created_by").references((): AnyPgColumn => platformAdmins.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("platform_admins_email_uidx").on(t.email),
    index("platform_admins_status_idx").on(t.status),
    check("platform_admins_email_normalized_chk", isNormalized(t.email)),
    check(
      "platform_admins_name_chk",
      sql`char_length(${t.name}) between 1 and 100 and ${t.name} = btrim(${t.name})`
    ),
    check("platform_admins_failed_attempts_chk", sql`${t.failedAttempts} >= 0`),
    // An enabled TOTP always has its secret; a verified enrollment always has a timestamp.
    check(
      "platform_admins_totp_pair_chk",
      sql`(${t.totpEnabledAt} is null) = (${t.totpSecretEnc} is null)`
    ),
    // Mandatory TOTP (Q16): only an invited (not yet enrolled) admin may lack it.
    check(
      "platform_admins_status_totp_chk",
      sql`(${t.status} = 'invited') = (${t.totpEnabledAt} is null)`
    ),
  ]
)

export type PlatformAdmin = typeof platformAdmins.$inferSelect
export type NewPlatformAdmin = typeof platformAdmins.$inferInsert
