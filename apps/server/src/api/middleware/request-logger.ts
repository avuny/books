import { createMiddleware } from "hono/factory"
import { createLogger, isLogLevel } from "../../lib/logger.js"
import type { AppEnv } from "../../types.js"

/**
 * Creates a per-request logger (tagged with the request id) and logs one
 * line when the request completes. Must run after the requestId() middleware.
 */
export const requestLogger = createMiddleware<AppEnv>(async (c, next) => {
  // Worker env is only available per request, so the logger is built here.
  const level = isLogLevel(c.env?.LOG_LEVEL) ? c.env.LOG_LEVEL : "info"
  const logger = createLogger({
    level,
    bindings: { requestId: c.var.requestId },
  })

  c.set("logger", logger)

  const start = Date.now()
  await next()

  logger.info(
    {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Date.now() - start,
    },
    "request_completed"
  )
})
