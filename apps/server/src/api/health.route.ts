import { createRoute, z } from "@hono/zod-openapi"
import { config } from "../config.js"
import { createOpenAPIRouter } from "./create-openapi-router.js"

const HealthResponseSchema = z
  .object({
    status: z.literal("ok"),
    service: z.string(),
    version: z.string(),
    environment: z.string(),
    timestamp: z.string(),
  })
  .openapi("HealthResponse")

const healthCheck = createRoute({
  method: "get",
  path: "/health",
  tags: ["Health"],
  summary: "Health check",
  description: "Returns 200 when the service is up and able to handle requests.",
  responses: {
    200: {
      description: "Service is healthy",
      content: {
        "application/json": {
          schema: HealthResponseSchema,
        },
      },
    },
  },
})

const healthRoute = createOpenAPIRouter().openapi(healthCheck, (c) => {
  return c.json(
    {
      status: "ok" as const,
      service: config.APP_NAME,
      version: config.APP_VERSION,
      environment: c.env?.ENVIRONMENT ?? "development",
      timestamp: new Date().toISOString(),
    },
    200
  )
})

export default healthRoute
