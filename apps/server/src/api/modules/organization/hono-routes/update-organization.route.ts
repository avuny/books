import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import {
  UpdateOrganizationSchema,
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

const updateOrganizationErrorMap = {
  ORGANIZATION_NOT_FOUND: organizationErrorsHttpMap.ORGANIZATION_NOT_FOUND,
  ORGANIZATION_FORBIDDEN: organizationErrorsHttpMap.ORGANIZATION_FORBIDDEN,
  ORGANIZATION_NAME_TAKEN: organizationErrorsHttpMap.ORGANIZATION_NAME_TAKEN,
} as const

export const updateOrganizationRoute = createRoute({
  method: "patch",
  path: "/{id}",
  operationId: "updateOrganization",
  tags: ["organization"],
  summary: "Update organization details",
  middleware: [requireAuth] as const,
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
    body: {
      content: {
        "application/json": {
          schema: UpdateOrganizationSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Organization updated successfully",
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
    409: {
      description: "Organization name already taken",
      content: {
        "application/json": {
          schema: createDomainErrorResponseSchema([
            OrganizationErrorCode.ORGANIZATION_NAME_TAKEN,
          ]),
        },
      },
    },
    ...globalErrorResponses,
  },
})

router.use("/:id", requireAuth)

router.openapi(updateOrganizationRoute, async (c) => {
  const lang = getRequestLocale()
  const errorTrans = trans({ lang })
  const user = c.get("user")
  const { id } = c.req.valid("param")
  const body = c.req.valid("json")

  const result = await organizationService.update(user.id, id, body)

  return handleResult({
    c,
    result,
    successStatus: 200,
    errorMap: updateOrganizationErrorMap,
    errorTrans,
    moduleName: "organization",
  })
})

export default router
