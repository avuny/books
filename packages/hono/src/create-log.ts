// REFACTOR: packages/hono/src/create-log.ts
import type { Context } from "hono"
import { logger, type Logger } from "@avuny/logger"
import type { ResultMeta } from "@avuny/utils"

export function logHttpRequest({
  c,
  level,
  msg,
  errorCode,
  meta,
  error,
}: {
  c: Context
  level: "info" | "warn" | "error"
  msg?: string
  errorCode?: string
  meta?: ResultMeta

  error?: unknown
}) {
  const log: Logger = c.var.logger ?? logger

  log[level](
    {
      method: c.req.method,
      path: c.req.path, // full url dropped: query strings can leak tokens
      userId: c.var.user?.id,
      organizationId: c.var.organizationId,
      errorCode,
      meta,
      error,
    },
    msg
  )
}
