import { createDbClient, type Database } from "@avuny/db"
import { config } from "./config.js"

export const db: Database = createDbClient(config.DATABASE_URL)
export type { Database }
