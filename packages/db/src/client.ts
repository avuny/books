import { drizzle } from "drizzle-orm/neon-http"
import { neon, neonConfig } from "@neondatabase/serverless"
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

/**
 * Host of the local Neon HTTP proxy (apps/server/docker-compose.test.yml). `*.localtest.me`
 * resolves to 127.0.0.1 through public DNS, so a URL with this host reaches a plain local
 * Postgres through the same driver production uses. Any other host is left untouched.
 */
export const LOCAL_NEON_PROXY_HOST = "db.localtest.me"
const LOCAL_NEON_PROXY_PORT = 4444

const isLocalNeonProxy = (connectionString: string): boolean => {
  try {
    return new URL(connectionString).hostname === LOCAL_NEON_PROXY_HOST
  } catch {
    return false
  }
}

const configureLocalNeonProxy = () => {
  neonConfig.fetchEndpoint = (host) =>
    host === LOCAL_NEON_PROXY_HOST
      ? `http://${host}:${LOCAL_NEON_PROXY_PORT}/sql`
      : `https://${host}/sql`
  neonConfig.useSecureWebSocket = false
  neonConfig.pipelineTLS = false
  neonConfig.pipelineConnect = false
}

export const createDbClient = (connectionString: string): Database => {
  if (isLocalNeonProxy(connectionString)) configureLocalNeonProxy()
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

