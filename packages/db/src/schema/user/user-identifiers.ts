import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { isNormalized, pk, timestamps, timestamptz } from "./_helpers.js"
import { E164_RE, EMAIL_RE } from "./identifier-patterns.js"
import { users } from "./users.js"

export const identifierTypeEnum = pgEnum("identifier_type", [
  "email",
  "phone",
  "username",
])
export type IdentifierType = (typeof identifierTypeEnum.enumValues)[number]

/**
 * USER_IDENTIFIERS: the ways a user can sign in (email, phone, username). Max 4 per user, one primary.
 * The max-4 rule and the delete rules are enforced by the repository in a transaction that locks
 * the user row (FOR UPDATE); the constraints below cover everything the database can express.
 * Diff this file against the existing user-identifiers.ts before applying.
 * (Relations: ./relations.ts)
 */
export const userIdentifiers = pgTable(
  "user_identifiers",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: identifierTypeEnum("type").notNull(),
    // Normalized (D1): email/username trimmed + lowercased, phone in E.164.
    value: text("value").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    // Required for email/phone (proven by OTP); usernames are never "verified".
    verifiedAt: timestamptz("verified_at"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("user_identifiers_type_value_uidx").on(t.type, t.value),
    uniqueIndex("user_identifiers_one_primary_per_user_uidx")
      .on(t.userId)
      .where(sql`${t.isPrimary} = true`),
    index("user_identifiers_user_id_idx").on(t.userId),
    check("user_identifiers_value_normalized_chk", isNormalized(t.value)),
    check(
      "user_identifiers_value_length_chk",
      sql`char_length(${t.value}) between 3 and 254`
    ),
    // D1: no value can classify as two types. The 3-32 character self-chosen username rule stays
    // in the application because managed usernames (name@orgslug) are longer.
    check(
      "user_identifiers_type_value_chk",
      sql`(${t.type} = 'email' and ${t.value} ~ ${EMAIL_RE}) or (${t.type} = 'phone' and ${t.value} ~ ${E164_RE}) or (${t.type} = 'username' and ${t.value} !~ ${EMAIL_RE} and ${t.value} !~ ${E164_RE} and ${t.value} !~ '[[:space:]]')`
    ),
    // verified_at may be null only for usernames.
    check(
      "user_identifiers_verified_chk",
      sql`${t.type} = 'username' or ${t.verifiedAt} is not null`
    ),
  ]
)

export type UserIdentifier = typeof userIdentifiers.$inferSelect
export type NewUserIdentifier = typeof userIdentifiers.$inferInsert
