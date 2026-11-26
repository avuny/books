import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter, getRequestLocale } from "@avuny/hono"
import {
  StateListQuerySchema,
  StateListResponseSchema,
} from "@avuny/contracts"
import {
  createResponseSchema,
  globalErrorResponses,
} from "@avuny/utils"
import { geoService } from "../geo.service.js"

const router = createOpenAPIRouter()

export const stateListRoute = createRoute({
  method: "get",
  path: "/states",
  operationId: "listStates",
  tags: ["geo"],
  summary: "List states / provinces",
  description: "Retrieve states or provinces, optionally filtered by country code or search query.",
  request: {
    query: StateListQuerySchema,
  },
  responses: {
    200: {
      description: "States retrieved successfully",
      content: {
        "application/json": {
          schema: createResponseSchema(StateListResponseSchema),
        },
      },
    },
    ...globalErrorResponses,
  },
})

router.openapi(stateListRoute, async (c) => {
  const query = c.req.valid("query")
  const locale = getRequestLocale()

  const result = await geoService.listStates({
    countryCode: query.countryCode,
    search: query.search,
    locale,
  })

  return c.json({ success: true, data: result.data }, 200)
})

export default router
