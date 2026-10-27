import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale } from "@avuny/hono"
import {
  StateListResponseSchema,
} from "@avuny/contracts"
import {
  createResponseSchema,
  globalErrorResponses,
} from "@avuny/utils"
import { geoService } from "../geo.service.js"

const router = createOpenAPIRouter()

export const countryStatesRoute = createRoute({
  method: "get",
  path: "/countries/{code}/states",
  operationId: "listCountryStates",
  tags: ["geo"],
  summary: "List states for a specific country",
  description: "Retrieve states or provinces that belong to a given country ISO code.",
  request: {
    params: z.object({
      code: z.string().length(2),
    }),
    query: z.object({
      search: z.string().optional(),
    }),
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

router.openapi(countryStatesRoute, async (c) => {
  const { code } = c.req.valid("param")
  const query = c.req.valid("query")
  const locale = getRequestLocale()

  const result = await geoService.listStates({
    countryCode: code,
    search: query.search,
    locale,
  })

  return c.json({ success: true, data: result.data }, 200)
})

export default router
