import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter } from "@avuny/hono"
import {
  CurrencyListQuerySchema,
  CurrencyListResponseSchema,
} from "@avuny/contracts"
import {
  createResponseSchema,
  globalErrorResponses,
} from "@avuny/utils"
import { geoService } from "../geo.service.js"

const router = createOpenAPIRouter()

export const currencyListRoute = createRoute({
  method: "get",
  path: "/currencies",
  operationId: "listCurrencies",
  tags: ["geo"],
  summary: "List currencies",
  description: "Retrieve ISO 4217 currencies with optional search filtering.",
  request: {
    query: CurrencyListQuerySchema,
  },
  responses: {
    200: {
      description: "Currencies retrieved successfully",
      content: {
        "application/json": {
          schema: createResponseSchema(CurrencyListResponseSchema),
        },
      },
    },
    ...globalErrorResponses,
  },
})

router.openapi(currencyListRoute, async (c) => {
  const query = c.req.valid("query")

  const result = await geoService.listCurrencies({
    search: query.search,
  })

  return c.json({ success: true, data: result.data }, 200)
})

export default router
