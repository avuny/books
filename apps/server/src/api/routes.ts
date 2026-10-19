import { swaggerUI } from "@hono/swagger-ui"
import { onError } from "./onError.js"

import {
  createOpenAPIRouter,
  requestLogger,
  resolveRequestLanguageMiddleware,
} from "@avuny/hono"
import { requestId } from "hono/request-id"

import healthRoute from "./health.route.js"
import { installRequestLanguage } from "./intl/i18next.js"
import { otpRoutes } from "./modules/otp/index.js"
import { authRoutes } from "./modules/auth/index.js"
import { usersRoutes } from "./modules/users/index.js"
import { adminRoutes } from "./modules/admin/index.js"
import { cors } from "hono/cors"
import { config } from "./index.js"

const APP_NAME = "hono-worker-api"
const APP_VERSION = "1.0.0"
const API_BASE_PATH = "/api"

// Initialize server i18n once at startup. Must be called before any request
// uses trans(). Never call i18n.changeLanguage() after this — it is global and
// races between concurrent requests.
installRequestLanguage()

export const app = createOpenAPIRouter().basePath(API_BASE_PATH)

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(
  "*",
  cors({
    origin: (origin) => {
      // Allow any port on localhost during development only.
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

      // Production: require an exact match.
      return config.CORS_ORIGINS.includes(origin) ? origin : ""
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Organization-Id",
      "X-Requested-With",
    ],
    maxAge: 600,
  })
)

app.use(resolveRequestLanguageMiddleware)
app.use(requestId())
app.use(requestLogger())

// ── Routes ────────────────────────────────────────────────────────────────────
app.route("/", healthRoute)
app.route("/otp", otpRoutes)
app.route("/auth", authRoutes)
app.route("/users", usersRoutes)
app.route("/admin", adminRoutes)

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
