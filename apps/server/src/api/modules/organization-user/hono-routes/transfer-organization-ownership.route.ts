import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import {
  OrganizationUserDtoSchema,
  OrganizationUserErrorCode as Code,
  TransferOrganizationOwnershipSchema,
} from "@avuny/contracts"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { organizationUserErrorsHttpMap as errors } from "../organization-user.errors.js"
import { organizationUserService } from "../organization-user.service.js"
import { requireAuth } from "../../auth/index.js"
import { honoPath, jsonError, jsonOk } from "./_shared.js"

const router = createOpenAPIRouter()

const rawErrorMap = {
  ORGANIZATION_USER_NOT_FOUND: errors.ORGANIZATION_USER_NOT_FOUND,
  ORGANIZATION_USER_FORBIDDEN: errors.ORGANIZATION_USER_FORBIDDEN,
  ORGANIZATION_USER_INVALID_OWNER_TARGET: errors.ORGANIZATION_USER_INVALID_OWNER_TARGET,
  ORGANIZATION_USER_CONFIRMATION_MISMATCH: errors.ORGANIZATION_USER_CONFIRMATION_MISMATCH,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const transferOrganizationOwnershipRoute = createRoute({
  method: "post",
  path: "/organizations/{orgId}/ownership-transfer",
  operationId: "transferOrganizationOwnership",
  tags: ["organization-user"],
  summary: "Transfer organization ownership to another managed member",
  middleware: [requireAuth] as const,
  request: {
    params: z.object({ orgId: z.string().uuid() }),
    body: {
      content: {
        "application/json": { schema: TransferOrganizationOwnershipSchema },
      },
    },
  },
  responses: {
    200: jsonOk("Ownership transferred; returns the new owner", OrganizationUserDtoSchema),
    403: jsonError("Forbidden", [Code.ORGANIZATION_USER_FORBIDDEN]),
    404: jsonError("Member not found", [Code.ORGANIZATION_USER_NOT_FOUND]),
    409: jsonError("Invalid target", [Code.ORGANIZATION_USER_INVALID_OWNER_TARGET]),
    422: jsonError("Confirmation mismatch", [Code.ORGANIZATION_USER_CONFIRMATION_MISMATCH]),
    ...globalErrorResponses,
  },
})

router.use(honoPath(transferOrganizationOwnershipRoute.path), requireAuth)

router.openapi(transferOrganizationOwnershipRoute, async (c) => {
  const errorTrans = trans({ lang: getRequestLocale() })
  const user = c.get("user")
  const { orgId } = c.req.valid("param")
  const body = c.req.valid("json")

  const result = await organizationUserService.transferOwnership(user.id, orgId, body)
  return handleResult({
    c,
    result,
    successStatus: 200,
    errorMap,
    errorTrans,
    moduleName: "organization-user",
  })
})

export default router
