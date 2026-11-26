import { sql, type SQL } from "drizzle-orm"
import {
  bigint,
  char,
  numeric,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core"
import {
  QUANTITY_PRECISION,
  QUANTITY_SCALE,
} from "@avuny/contracts/unit"
import {
  CONVERSION_FACTOR_PRECISION,
  CONVERSION_FACTOR_SCALE,
} from "@avuny/contracts/unit-collection"

/**
 * SHARED COLUMNS & UTILS: the ONLY cross-cutting file of the schema.
 * Enums and jsonb types are NOT here; each lives in the table file that owns it.
 */

/* ---------- primary key ---------- */

// Random UUIDv4 by default. For better index locality use time-ordered UUIDv7:
// `.default(sql`uuidv7()`)` on PostgreSQL 18+, or an app-side `$defaultFn` before that.
export const pk = (name = "id") => uuid(name).defaultRandom().primaryKey()

/* ---------- timestamps ---------- */

export const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" })

export const createdAt = () => timestamptz("created_at").notNull().defaultNow()

// $onUpdate is app-side only: raw SQL updates will not bump it (add a trigger if that matters).
export const updatedAt = () =>
  timestamptz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())

/** Spread into a table: `...timestamps()` */
export const timestamps = () => ({
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

/** Spread into a table: `...softDelete()` (nullable `deleted_at`). */
export const softDelete = () => ({ deletedAt: timestamptz("deleted_at") })

/* ---------- money ---------- */

// Money = integer minor units (bigint) + ISO-4217 currency. Never float/numeric.
// bigint "number" mode is exact up to 2^53 - 1 minor units.
export const money = (name: string) =>
  bigint(name, { mode: "number" }).notNull()

// Pass a name when a table has more than one currency column.
export const currency = (name = "currency") =>
  char(name, { length: 3 }).notNull()

/* ---------- quantities & unit conversion ---------- */

// Stock quantity in the item's BASE unit: numeric(18, 6). Nullable by default, chain
// `.notNull()` where required. Drizzle returns numeric as a string: use a decimal
// library for arithmetic, never JS floats.
export const quantity = (name: string) =>
  numeric(name, { precision: QUANTITY_PRECISION, scale: QUANTITY_SCALE })

// Units of the BASE unit that one of this unit equals (cm -> 0.01 m). numeric(24, 12).
// Also use it (with `quantity()`) for the "entered unit + conversion snapshot" columns on
// source documents and stock-movement lines.
export const conversionFactor = (name = "conversion_factor") =>
  numeric(name, {
    precision: CONVERSION_FACTOR_PRECISION,
    scale: CONVERSION_FACTOR_SCALE,
  }).notNull()

/* ---------- check-constraint helpers ---------- */

// Use inside a table's extra-config callback:
//   check("users_email_normalized", isNormalized(t.email))
//   check("users_username_format", isUsername(t.username))
// NULL passes every check below; pair with .notNull() where a value is required.

/**
 * Value is already trimmed + lowercase and not empty.
 * btrim() strips spaces only, so still trim other whitespace app-side.
 */
export const isNormalized = (col: AnyPgColumn): SQL =>
  sql`(${col} = lower(btrim(${col})) AND ${col} <> '')`

/**
 * `col ~ 'pattern'` with the pattern inlined (check constraints cannot use bind
 * params). Single quotes are escaped, but pass constants only, never user input.
 */
export const matchesRegex = (col: AnyPgColumn, pattern: string): SQL =>
  sql`${col} ~ ${sql.raw(`'${pattern.replace(/'/g, "''")}'`)}`

/**
 * `char_length(col) BETWEEN min AND max`, with the bounds inlined from the shared
 * contracts constants (check constraints cannot use bind params), so the API schema
 * and the database never drift apart. Integers only; throws otherwise.
 */
const inlineInt = (n: number): SQL => {
  if (!Number.isInteger(n)) throw new Error(`Expected an integer, got ${n}`)
  return sql.raw(String(n))
}
export const lengthBetween = (col: AnyPgColumn, min: number, max: number): SQL =>
  sql`char_length(${col}) BETWEEN ${inlineInt(min)} AND ${inlineInt(max)}`

/** Per-organization sign-in handle: lowercase, 3-31 chars, no ':' or '@'. */
export const USERNAME_PATTERN = "^[a-z0-9][a-z0-9._-]{2,30}$"
export const isUsername = (col: AnyPgColumn): SQL =>
  matchesRegex(col, USERNAME_PATTERN)

/** ISO-4217 alphabetic code: three uppercase letters. */
export const CURRENCY_PATTERN = "^[A-Z]{3}$"
export const isCurrency = (col: AnyPgColumn): SQL =>
  matchesRegex(col, CURRENCY_PATTERN)
