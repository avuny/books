import { swaggerUI } from "@hono/swagger-ui"
import { createOpenAPIRouter, requestLogger } from "@avuny/hono"
import { cors } from "hono/cors"
import { requestId } from "hono/request-id"

import { config } from "./index.js"
import healthRoute from "./health.route.js"
import { onError } from "./onError.js"

const APP_NAME = "avuny-platform-api"
const APP_VERSION = "0.1.0"
const API_BASE_PATH = "/api"

export const app = createOpenAPIRouter().basePath(API_BASE_PATH)

// ── Middleware ────────────────────────────────────────────────────────────────
// CORS: the admin web app origin only. The tenant web app is never allowed.
app.use(
  "*",
  cors({
    origin: (origin) => {
      if (config.NODE_ENV === "development") {
        try {
          const url = new URL(origin)
          if (
            url.protocol === "http:" &&
            ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
          ) {
            return origin
          }
        } catch {
          // Invalid origin: continue to the configured allowlist.
        }
      }
      return config.CORS_ORIGINS.includes(origin) ? origin : ""
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "X-Requested-With"],
    maxAge: 600,
  })
)

app.use(requestId())
app.use(requestLogger())

// ── Routes ────────────────────────────────────────────────────────────────────
// Feature modules are mounted here (src/api/modules/<name>), same pattern as apps/server.
// Every platform route must declare its required permission (PLATFORM-ADMIN-SPEC PA-R7).
app.route("/", healthRoute)

app.notFound((c) =>
  c.json(
    {
      success: false,
      type: "not_found",
      code: "NOT_FOUND",
      message: "Route not found",
    },
    404
  )
)

app.onError(onError)

// ── OpenAPI docs ──────────────────────────────────────────────────────────────
app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: { title: APP_NAME, version: APP_VERSION },
})

app.get("/docs", swaggerUI({ url: `${API_BASE_PATH}/openapi.json` }))
