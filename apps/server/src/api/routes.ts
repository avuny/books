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
import { cors } from "hono/cors"
// [codegen:imports:start]
import { adminRoutes } from "./modules/admin/index.js"
import { authRoutes } from "./modules/auth/index.js"
import { geoRoutes } from "./modules/geo/index.js"
import { organizationRoutes } from "./modules/organization/index.js"
import { organizationInvitationRoutes } from "./modules/organization-invitation/index.js"
import { organizationUserRoutes } from "./modules/organization-user/index.js"
import { otpRoutes } from "./modules/otp/index.js"
import { roleRoutes } from "./modules/role/index.js"
import { sidebarRoutes } from "./modules/sidebar/index.js"
import { usersRoutes } from "./modules/users/index.js"
// [codegen:imports:end]
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
      "X-Lang",
      "accept-language"
    ],
    maxAge: 600,
  })
)

app.use(resolveRequestLanguageMiddleware)
app.use(requestId())
app.use(requestLogger())

// ── Routes ────────────────────────────────────────────────────────────────────
app.route("/", healthRoute)
// [codegen:routes:start]
app.route("/admin", adminRoutes)
app.route("/auth", authRoutes)
app.route("/geo", geoRoutes)
app.route("/organizations", organizationRoutes)
app.route("/organization-invitations", organizationInvitationRoutes)
app.route("/organization-users", organizationUserRoutes)
app.route("/otp", otpRoutes)
app.route("/roles", roleRoutes)
app.route("/sidebar", sidebarRoutes)
app.route("/users", usersRoutes)
// [codegen:routes:end]

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
