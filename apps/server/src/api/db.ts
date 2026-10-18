import { createDbClient, type Database } from "@avuny/db"
import { config } from "./config.js"

let _db: Database | undefined
export const getDb = (): Database =>
  (_db ??= createDbClient(config.DATABASE_URL))

// keeps existing `import { db }` working
export const db: Database = new Proxy({} as Database, {
  get: (_, key) => {
    const real = getDb()
    const value = real[key as keyof Database]
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(real)
      : value
  },
})

export type { Database }