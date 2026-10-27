import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter, getRequestLocale } from "@avuny/hono"
import {
  CountryListQuerySchema,
  CountryListResponseSchema,
} from "@avuny/contracts"
import {
  createResponseSchema,
  globalErrorResponses,
} from "@avuny/utils"
import { geoService } from "../geo.service.js"

const router = createOpenAPIRouter()

export const countryListRoute = createRoute({
  method: "get",
  path: "/countries",
  operationId: "listCountries",
  tags: ["geo"],
  summary: "List countries",
  description: "Retrieve a list of countries with optional search filtering and localized names.",
  request: {
    query: CountryListQuerySchema,
  },
  responses: {
    200: {
      description: "Countries retrieved successfully",
      content: {
        "application/json": {
          schema: createResponseSchema(CountryListResponseSchema),
        },
      },
    },
    ...globalErrorResponses,
  },
})

router.openapi(countryListRoute, async (c) => {
  const query = c.req.valid("query")
  const locale = getRequestLocale()

  const result = await geoService.listCountries({
    search: query.search,
    locale,
  })

  return c.json({ success: true, data: result.data }, 200)
})

export default router
