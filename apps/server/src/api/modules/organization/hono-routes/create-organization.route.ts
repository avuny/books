import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import {
  CreateOrganizationSchema,
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

const createOrganizationErrorMap = {
  ORGANIZATION_FORBIDDEN: organizationErrorsHttpMap.ORGANIZATION_FORBIDDEN,
  ORGANIZATION_LIMIT_REACHED: organizationErrorsHttpMap.ORGANIZATION_LIMIT_REACHED,
  ORGANIZATION_NAME_TAKEN: organizationErrorsHttpMap.ORGANIZATION_NAME_TAKEN,
  ORGANIZATION_CODE_TAKEN: organizationErrorsHttpMap.ORGANIZATION_CODE_TAKEN,
  ORGANIZATION_CODE_RESERVED: organizationErrorsHttpMap.ORGANIZATION_CODE_RESERVED,
} as const

export const createOrganizationRoute = createRoute({
  method: "post",
  path: "/",
  operationId: "createOrganization",
  tags: ["organization"],
  summary: "Create a new organization",
  middleware: [requireAuth] as const,
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateOrganizationSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Organization created successfully",
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
    409: {
      description: "Conflict (limit reached, name taken, or code taken)",
      content: {
        "application/json": {
          schema: createDomainErrorResponseSchema([
            OrganizationErrorCode.ORGANIZATION_LIMIT_REACHED,
            OrganizationErrorCode.ORGANIZATION_NAME_TAKEN,
            OrganizationErrorCode.ORGANIZATION_CODE_TAKEN,
          ]),
        },
      },
    },
    422: {
      description: "Organization code is reserved",
      content: {
        "application/json": {
          schema: createDomainErrorResponseSchema([
            OrganizationErrorCode.ORGANIZATION_CODE_RESERVED,
          ]),
        },
      },
    },
    ...globalErrorResponses,
  },
})

router.use("/", requireAuth)

router.openapi(createOrganizationRoute, async (c) => {
  const lang = getRequestLocale()
  const errorTrans = trans({ lang })
  const user = c.get("user")
  const body = c.req.valid("json")

  const result = await organizationService.create(user.id, body)

  return handleResult({
    c,
    result,
    successStatus: 201,
    errorMap: createOrganizationErrorMap,
    errorTrans,
    moduleName: "organization",
  })
})

export default router
