import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import {
  CountryDetailDtoSchema,
  GeoErrorCode,
} from "@avuny/contracts"
import {
  createResponseSchema,
  createDomainErrorResponseSchema,
  globalErrorResponses,
} from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { geoErrorsHttpMap } from "../geo.errors.js"
import { geoService } from "../geo.service.js"

const router = createOpenAPIRouter()

const getCountryErrorMap = {
  COUNTRY_NOT_FOUND: geoErrorsHttpMap.COUNTRY_NOT_FOUND,
} as const

export const getCountryRoute = createRoute({
  method: "get",
  path: "/countries/{code}",
  operationId: "getCountryByCode",
  tags: ["geo"],
  summary: "Get country by ISO code",
  description: "Retrieve country details including associated timezones and default currency.",
  request: {
    params: z.object({
      code: z.string().length(2),
    }),
  },
  responses: {
    200: {
      description: "Country retrieved successfully",
      content: {
        "application/json": {
          schema: createResponseSchema(CountryDetailDtoSchema),
        },
      },
    },
    404: {
      description: "Country not found",
      content: {
        "application/json": {
          schema: createDomainErrorResponseSchema([
            GeoErrorCode.COUNTRY_NOT_FOUND,
          ]),
        },
      },
    },
    ...globalErrorResponses,
  },
})

router.openapi(getCountryRoute, async (c) => {
  const lang = getRequestLocale()
  const errorTrans = trans({ lang })
  const { code } = c.req.valid("param")

  const result = await geoService.getCountryByCode(code, lang)

  return handleResult({
    c,
    result,
    successStatus: 200,
    errorMap: getCountryErrorMap,
    errorTrans,
    moduleName: "geo",
  })
})

export default router
