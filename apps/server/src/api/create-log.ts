import type { Context } from "hono"
import { createLogger, type Logger, type LogLevel } from "../lib/logger.js"

type LogHttpRequestOptions = {
  c: Context
  level: LogLevel
  msg: string
  error?: unknown
}

/**
 * Logs a message together with the request context (method, path, requestId).
 * Uses the per-request logger set by the request-logger middleware when present.
 */
export function logHttpRequest({ c, level, msg, error }: LogHttpRequestOptions) {
  const logger: Logger = c.get("logger") ?? createLogger()

  logger[level](
    {
      requestId: c.get("requestId"),
      method: c.req.method,
      path: c.req.path,
      ...(error !== undefined ? { error } : {}),
    },
    msg
  )
}
