import { logHttpRequest } from "@avuny/hono"
import type { ErrorHandler } from "hono"
// this for unhandled errors in the Hono app, such as uncaught exceptions or unhandled promise rejections. It logs the error and returns a standardized JSON response with a 500 status code.
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
