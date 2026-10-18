import { sql } from "drizzle-orm"
import {
  check,
  index,
  inet,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { pk, timestamps, timestamptz } from "./_helpers.js"
import { users } from "./users.js"

export const sessionPlatformEnum = pgEnum("session_platform", ["web", "mobile"])
export type SessionPlatform = (typeof sessionPlatformEnum.enumValues)[number]

export const sessionRevokedReasonEnum = pgEnum("session_revoked_reason", [
  "sign_out",
  "sign_out_all",
  "password_changed",
  "password_reset",
  "admin",
  "suspended",
  "reuse_detected",
])
export type SessionRevokedReason =
  (typeof sessionRevokedReasonEnum.enumValues)[number]

/**
 * SESSIONS: one row per signed-in device. Replaces refresh_tokens (its family_id is now this id).
 * The access token carries `sid` = id and the middleware loads this row on every request, so a
 * revoked or expired session is rejected immediately (D3). Only hashes of refresh tokens are stored (D4).
 * (Relations: ./relations.ts)
 */
export const sessions = pgTable(
  "sessions",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Lowercase hex SHA-256 of the current refresh token.
    refreshTokenHash: text("refresh_token_hash").notNull(),
    // Hex SHA-256 of the token that was current before the last rotation.
    // Presenting it again is reuse: revoke the session (reuse_detected) and audit it.
    previousRefreshTokenHash: text("previous_refresh_token_hash"),
    platform: sessionPlatformEnum("platform").notNull(),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    // x-device-name header, else parsed from the user agent.
    deviceName: text("device_name"),
    // Sliding: now() + REFRESH_TOKEN_TTL on every rotation (AU-5).
    expiresAt: timestamptz("expires_at").notNull(),
    // Set on sign-in and refresh only, never per request.
    lastUsedAt: timestamptz("last_used_at").notNull().defaultNow(),
    revokedAt: timestamptz("revoked_at"),
    revokedReason: sessionRevokedReasonEnum("revoked_reason"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("sessions_refresh_token_hash_uidx").on(t.refreshTokenHash),
    index("sessions_previous_refresh_token_hash_idx")
      .on(t.previousRefreshTokenHash)
      .where(sql`${t.previousRefreshTokenHash} is not null`),
    index("sessions_user_id_idx").on(t.userId),
    // Cleanup job (expired and revoked sessions).
    index("sessions_expires_at_idx").on(t.expiresAt),
    // A revoked session always says why, and an active one never has a reason.
    check(
      "sessions_revoked_pair_chk",
      sql`(${t.revokedAt} is null) = (${t.revokedReason} is null)`
    ),
    check(
      "sessions_previous_hash_differs_chk",
      sql`${t.previousRefreshTokenHash} is distinct from ${t.refreshTokenHash}`
    ),
  ]
)

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
