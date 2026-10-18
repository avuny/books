// NEW: packages/hono/src/middleware/request-logger.ts
// Register first: app.use("*", requestLogger())
import { randomUUID } from "node:crypto"
import { createMiddleware } from "hono/factory"
import { logger } from "@avuny/logger"

export const requestLogger = () =>
  createMiddleware(async (c, next) => {
    const requestId = c.req.header("x-request-id") ?? randomUUID()
    const log = logger.child({
      requestId,
      method: c.req.method,
      path: c.req.path,
    })

    c.set("logger", log)
    c.header("x-request-id", requestId)

    const start = performance.now()
    await next()

    const status = c.res.status
    log[status >= 500 ? "error" : "info"](
      {
        status,
        durationMs: Math.round(performance.now() - start),
        userId: c.var.user?.id,
        organizationId: c.var.organizationId,
      },
      "request completed"
    )
  })
