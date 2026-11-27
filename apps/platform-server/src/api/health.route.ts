import { OpenAPIHono, createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"

const app = new OpenAPIHono()

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  responses: {
    200: {
      description: "Service is healthy",
      content: {
        "application/json": {
          schema: z.object({
            status: z.literal("ok"),
            service: z.literal("platform"),
            timestamp: z.string().datetime(),
          }),
        },
      },
    },
  },
})

app.openapi(healthRoute, (c) => {
  return c.json({
    status: "ok" as const,
    service: "platform" as const,
    timestamp: new Date().toISOString(),
  })
})

export default app
