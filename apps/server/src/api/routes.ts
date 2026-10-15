import { swaggerUI } from "@hono/swagger-ui"
import { requestId } from "hono/request-id"
import { config } from "../config.js"
import { createOpenAPIRouter } from "./create-openapi-router.js"
import healthRoute from "./health.route.js"
import { requestLogger } from "./middleware/request-logger.js"
import { onError } from "./onError.js"

export const app = createOpenAPIRouter().basePath(config.API_BASE_PATH)

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(requestId())
app.use(requestLogger)

// ── Routes ────────────────────────────────────────────────────────────────────
app.route("/", healthRoute)

// Register feature modules here, e.g.:
// import { usersRoutes } from "./modules/users/index.js"
// app.route("/users", usersRoutes)

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
  info: { title: "Hono Worker API", version: config.APP_VERSION },
})

app.get("/docs", swaggerUI({ url: `${config.API_BASE_PATH}/openapi.json` }))
