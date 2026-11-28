import { logHttpRequest } from "@avuny/hono"
import type { ErrorHandler } from "hono"

// Unhandled errors: log and return the standard JSON error body with status 500.
export const onError: ErrorHandler = (err, c) => {
  logHttpRequest({
    c,
    level: "error",
    error: err,
    msg: err.message,
  })

  return c.json(
    {
      success: false,
      type: "server",
      code: "SERVER_ERROR",
      message: err.message || "Internal server error",
    },
    500
  )
}
