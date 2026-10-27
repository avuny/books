import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter } from "@avuny/hono"
import {
  TimezoneListQuerySchema,
  TimezoneListResponseSchema,
} from "@avuny/contracts"
import {
  createResponseSchema,
  globalErrorResponses,
} from "@avuny/utils"
import { geoService } from "../geo.service.js"

const router = createOpenAPIRouter()

export const timezoneListRoute = createRoute({
  method: "get",
  path: "/timezones",
  operationId: "listTimezones",
  tags: ["geo"],
  summary: "List timezones",
  description: "Retrieve IANA timezones, optionally filtered by country code or search query.",
  request: {
    query: TimezoneListQuerySchema,
  },
  responses: {
    200: {
      description: "Timezones retrieved successfully",
      content: {
        "application/json": {
          schema: createResponseSchema(TimezoneListResponseSchema),
        },
      },
    },
    ...globalErrorResponses,
  },
})

router.openapi(timezoneListRoute, async (c) => {
  const query = c.req.valid("query")

  const result = await geoService.listTimezones({
    countryCode: query.countryCode,
    search: query.search,
  })

  return c.json({ success: true, data: result.data }, 200)
})

export default router
