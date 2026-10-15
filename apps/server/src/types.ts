import type { Logger, LogLevel } from "./lib/logger.js"

/** Worker bindings: vars and secrets from wrangler.jsonc / .dev.vars. */
export type Bindings = {
  ENVIRONMENT?: string
  LOG_LEVEL?: LogLevel
}

/** Per-request variables set by middleware (`requestId` comes from hono/request-id). */
export type Variables = {
  logger: Logger
}

export type AppEnv = {
  Bindings: Bindings
  Variables: Variables
}
