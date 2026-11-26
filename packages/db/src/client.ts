import { drizzle } from "drizzle-orm/neon-http"
import { drizzle as drizzlePool } from "drizzle-orm/neon-serverless"
import { neon, neonConfig, Pool } from "@neondatabase/serverless"
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

/** Minimal shape of the pool used for transactions, so tests can inject a fake. */
export type TransactionPool = { end: () => Promise<void> }

type TxRunner = <T>(
  run: (tx: Database) => Promise<T>,
  config?: unknown
) => Promise<T>

/**
 * Builds the real transaction runner: a short-lived Neon WebSocket pool per
 * transaction (BEGIN / COMMIT / ROLLBACK on one connection), closed afterwards.
 * A pool per call, never a shared one, because Workers forbid reusing I/O objects
 * across requests. Plain queries stay on the HTTP driver.
 */
export const createPoolTransactionRunner =
  (
    makePool: () => TransactionPool,
    wrap: (pool: TransactionPool) => Database = (pool) =>
      drizzlePool(pool as unknown as Pool, { schema }) as unknown as Database
  ): TxRunner =>
  async (run, config) => {
    const pool = makePool()
    try {
      const pooled = wrap(pool)
      return await (
        pooled.transaction as unknown as (
          cb: (tx: Database) => Promise<unknown>,
          c?: unknown
        ) => Promise<unknown>
      ).call(pooled, run as (tx: Database) => Promise<unknown>, config) as never
    } finally {
      await pool.end().catch(() => undefined)
    }
  }

export const createDbClient = (connectionString: string): Database => {
  const local = isLocalNeonProxy(connectionString)
  if (local) configureLocalNeonProxy()
  const sql = neon(connectionString)
  const db = drizzle(sql, { schema }) as unknown as Database

  // drizzle-orm/neon-http has no transactions (HTTP queries are stateless).
  // Production: run db.transaction on a real WebSocket connection so a failure
  // rolls everything back. The local test proxy speaks HTTP only, so there the
  // callback runs on the same client with no BEGIN/COMMIT (see docs/TESTING.md).
  db.transaction = (
    local
      ? async <T>(run: (tx: Database) => Promise<T>): Promise<T> => run(db)
      : createPoolTransactionRunner(
          () => new Pool({ connectionString }) as unknown as TransactionPool
        )
  ) as typeof db.transaction

  return db
}
