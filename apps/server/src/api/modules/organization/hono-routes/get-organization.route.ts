import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import {
  OrganizationDtoSchema,
  OrganizationErrorCode,
} from "@avuny/contracts"
import {
  createResponseSchema,
  createDomainErrorResponseSchema,
  globalErrorResponses,
} from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { organizationErrorsHttpMap } from "../organization.errors.js"
import { organizationService } from "../organization.service.js"
import { requireAuth } from "../../auth/index.js"

const router = createOpenAPIRouter()

const getOrganizationErrorMap = {
  ORGANIZATION_NOT_FOUND: organizationErrorsHttpMap.ORGANIZATION_NOT_FOUND,
  ORGANIZATION_FORBIDDEN: organizationErrorsHttpMap.ORGANIZATION_FORBIDDEN,
} as const

export const getOrganizationRoute = createRoute({
  method: "get",
  path: "/{id}",
  operationId: "getOrganization",
  tags: ["organization"],
  summary: "Get organization by ID",
  middleware: [requireAuth] as const,
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: "Organization retrieved successfully",
      content: {
        "application/json": {
          schema: createResponseSchema(OrganizationDtoSchema),
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: createDomainErrorResponseSchema([
            OrganizationErrorCode.ORGANIZATION_FORBIDDEN,
          ]),
        },
      },
    },
    404: {
      description: "Organization not found",
      content: {
        "application/json": {
          schema: createDomainErrorResponseSchema([
            OrganizationErrorCode.ORGANIZATION_NOT_FOUND,
          ]),
        },
      },
    },
    ...globalErrorResponses,
  },
})

router.use("/:id", requireAuth)

router.openapi(getOrganizationRoute, async (c) => {
  const lang = getRequestLocale()
  const errorTrans = trans({ lang })
  const user = c.get("user")
  const { id } = c.req.valid("param")

  const result = await organizationService.getById(user.id, id)

  return handleResult({
    c,
    result,
    successStatus: 200,
    errorMap: getOrganizationErrorMap,
    errorTrans,
    moduleName: "organization",
  })
})

export default router
