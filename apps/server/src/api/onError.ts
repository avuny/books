import type { ErrorHandler } from "hono"
import { logHttpRequest } from "./create-log.js"

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
