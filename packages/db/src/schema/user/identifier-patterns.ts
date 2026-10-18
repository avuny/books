import { sql } from "drizzle-orm"

/**
 * SQL regex literals shared by the CHECK constraints that mirror D1 (identifier classification).
 * They are deliberately looser than the application validators (zod, libphonenumber-js):
 * the database only guarantees that a value cannot be stored under the wrong type, and it
 * never rejects a value the application accepts.
 */

// Loose email: one "@", no whitespace, and a dot in the domain.
// Managed usernames (name@orgslug) have no dot after the "@", so they never match.
export const EMAIL_RE = sql.raw("'^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'")

// E.164: "+", a non-zero first digit, 7 to 15 digits in total.
export const E164_RE = sql.raw("'^[+][1-9][0-9]{6,14}$'")
