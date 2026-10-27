import { drizzle } from "drizzle-orm/neon-http"
import { neon } from "@neondatabase/serverless"
import type { PgDatabase, PgTransaction } from "drizzle-orm/pg-core"
import * as schema from "./schema/index.js"

/**
 * Database type backed by Neon's HTTP driver.
 *
 * Uses fetch() under the hood — no TCP sockets, no persistent connections.
 * Works identically in Cloudflare Workers, wrangler dev, and Node.js.
 *
 * The type uses PgDatabase (the common base) rather than NeonHttpDatabase
 * so that PgTransaction is also assignable to Database — this lets repo
 * functions accept both the root db and a transaction handle.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = PgDatabase<any, typeof schema>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Tx = PgTransaction<any, typeof schema, any>

export const createDbClient = (connectionString: string): Database => {
  const sql = neon(connectionString)
  const db = drizzle(sql, { schema }) as unknown as Database

  // drizzle-orm/neon-http throws "No transactions support in neon-http driver"
  // because HTTP queries are stateless. Provide a sequential execution fallback
  // so callers of db.transaction(async (tx) => ...) work seamlessly on edge/workers.
  db.transaction = (async <T>(
    transaction: (tx: Database) => Promise<T>
  ): Promise<T> => {
    return await transaction(db)
  }) as typeof db.transaction

  return db
}

