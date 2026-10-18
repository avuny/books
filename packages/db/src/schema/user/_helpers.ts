import { sql } from "drizzle-orm"
import { timestamp, uuid } from "drizzle-orm/pg-core"

export const pk = (name = "id") => uuid(name).defaultRandom().primaryKey()

export const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" })

export const timestamps = () => ({
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const isNormalized = (col: unknown) =>
  sql`${col} = btrim(lower(${col}))`
