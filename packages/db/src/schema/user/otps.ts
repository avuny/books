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
} from "drizzle-orm/pg-core"
import { isNormalized, pk, timestamps, timestamptz } from "./_helpers.js"
import { E164_RE, EMAIL_RE } from "./identifier-patterns.js"
import { users } from "./users.js"

// LOGIN was dropped: v1 sign-in is identifier + password (AU-2). ADD_IDENTIFIER and UPDATE_IDENTIFIER were added.
export const otpPurposeEnum = pgEnum("otp_purpose", [
  "SIGN_UP",
  "ADD_IDENTIFIER",
  "UPDATE_IDENTIFIER",
  "FORGET_PASSWORD",
])
export type OtpPurpose = (typeof otpPurposeEnum.enumValues)[number]

/**
 * OTPS: one-time codes. Only an HMAC is stored (hex HMAC-SHA256 of id + code, keyed with OTP_SECRET).
 * Row states: pending (verified_at and consumed_at null) -> verified (verified_at set, proof issued)
 * -> closed (consumed_at set: spent by its action, superseded by a newer code, or killed by attempts).
 */
export const otps = pgTable(
  "otps",
  {
    // = challengeId
    id: pk(),
    purpose: otpPurposeEnum("purpose").notNull(),
    // The normalized identifier as submitted. Not a foreign key because SIGN_UP can happen before the
    // user/identifier exists. For SIGN_UP, ADD_IDENTIFIER and UPDATE_IDENTIFIER it is the email/phone the
    // code goes to. For FORGET_PASSWORD it may be a username (delivery goes to that user's primary
    // verified email/phone), and rows for unknown identifiers are still created (D9).
    identifier: text("identifier").notNull(),
    // Set exactly for ADD_IDENTIFIER and UPDATE_IDENTIFIER: the proof is bound to the signed-in user.
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    // HMAC of the OTP using a server-side secret.
    otpHash: text("otp_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    // Limits code entry only; after verification the verification token's own expiry governs.
    expiresAt: timestamptz("expires_at").notNull(),
    verifiedAt: timestamptz("verified_at"),
    consumedAt: timestamptz("consumed_at"),
    ...timestamps(),
  },
  (t) => [
    // Resend cooldown and hourly send counts.
    index("otps_identifier_purpose_created_at_idx").on(
      t.identifier,
      t.purpose,
      t.createdAt
    ),
    // D7: one pending code per identifier and purpose. Issuing a code closes the pending one first
    // (same transaction); this index makes a concurrent race fail instead of creating two.
    uniqueIndex("otps_one_pending_per_identifier_purpose_uidx")
      .on(t.identifier, t.purpose)
      .where(sql`${t.verifiedAt} is null and ${t.consumedAt} is null`),
    index("otps_user_id_idx")
      .on(t.userId)
      .where(sql`${t.userId} is not null`),
    // Cleanup job.
    index("otps_expires_at_idx").on(t.expiresAt),
    check("otps_identifier_normalized_chk", isNormalized(t.identifier)),
    check(
      "otps_identifier_length_chk",
      sql`char_length(${t.identifier}) between 3 and 254`
    ),
    // Unless the purpose is FORGET_PASSWORD, the identifier is an email or an E.164 phone (ID-2, ID-3, ID-6).
    check(
      "otps_identifier_deliverable_chk",
      sql`${t.purpose} = 'FORGET_PASSWORD' or ${t.identifier} ~ ${EMAIL_RE} or ${t.identifier} ~ ${E164_RE}`
    ),
    // D8: authenticated purposes are bound to a user; public purposes never are.
    check(
      "otps_user_binding_chk",
      sql`(${t.purpose} in ('ADD_IDENTIFIER', 'UPDATE_IDENTIFIER')) = (${t.userId} is not null)`
    ),
    check("otps_attempts_non_negative_chk", sql`${t.attempts} >= 0`),
  ]
)

export type Otp = typeof otps.$inferSelect
export type NewOtp = typeof otps.$inferInsert
