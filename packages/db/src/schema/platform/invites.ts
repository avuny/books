import { sql } from "drizzle-orm"
import {
  check,
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { isNormalized, pk, timestamps, timestamptz } from "../_helpers.js"
import { platformAdmins } from "./admins.js"

/**
 * PLATFORM_INVITES: the only way a new admin arrives (PLATFORM-ADMIN-SPEC 3.2).
 * Single use, expires, revocable. `role_ids` snapshots the roles chosen at invite
 * time; acceptance creates the admin and grants exactly these. Only the SHA-256
 * hash of the invite token is stored.
 */
export const platformInvites = pgTable(
  "platform_invites",
  {
    id: pk(),
    // Trimmed + lowercase, same rule as platform_admins.email.
    email: text("email").notNull(),
    roleIds: uuid("role_ids").array().notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    acceptedAt: timestamptz("accepted_at"),
    revokedAt: timestamptz("revoked_at"),
    // NULL for the bootstrap invite created by the CLI.
    invitedBy: uuid("invited_by").references(() => platformAdmins.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("platform_invites_token_hash_uidx").on(t.tokenHash),
    index("platform_invites_email_idx").on(t.email),
    check("platform_invites_email_normalized_chk", isNormalized(t.email)),
    check("platform_invites_expiry_chk", sql`${t.expiresAt} > ${t.createdAt}`),
    // cardinality, not array_length: array_length('{}', 1) is NULL and NULL passes a CHECK.
    check(
      "platform_invites_role_ids_chk",
      sql`cardinality(${t.roleIds}) >= 1`
    ),
    // One terminal state only: an invite is accepted or revoked, never both.
    check(
      "platform_invites_terminal_chk",
      sql`not (${t.acceptedAt} is not null and ${t.revokedAt} is not null)`
    ),
  ]
)

export type PlatformInvite = typeof platformInvites.$inferSelect
export type NewPlatformInvite = typeof platformInvites.$inferInsert
