import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import {
  OrganizationUserDtoSchema,
  OrganizationUserErrorCode as Code,
  SetOrganizationUserStatusSchema,
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
  ORGANIZATION_USER_OWNER_PROTECTED: errors.ORGANIZATION_USER_OWNER_PROTECTED,
  ORGANIZATION_USER_SELF_ACTION_NOT_ALLOWED:
    errors.ORGANIZATION_USER_SELF_ACTION_NOT_ALLOWED,
  ORGANIZATION_USER_LIMIT_REACHED: errors.ORGANIZATION_USER_LIMIT_REACHED,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const setOrganizationUserStatusRoute = createRoute({
  method: "put",
  path: "/organizations/{orgId}/members/{memberId}/status",
  operationId: "setOrganizationUserStatus",
  tags: ["organization-user"],
  summary: "Deactivate or reactivate a member",
  middleware: [requireAuth] as const,
  request: {
    params: z.object({ orgId: z.string().uuid(), memberId: z.string().uuid() }),
    body: {
      content: { "application/json": { schema: SetOrganizationUserStatusSchema } },
    },
  },
  responses: {
    200: jsonOk("Member status updated", OrganizationUserDtoSchema),
    403: jsonError("Forbidden", [Code.ORGANIZATION_USER_FORBIDDEN]),
    404: jsonError("Member not found", [Code.ORGANIZATION_USER_NOT_FOUND]),
    409: jsonError("Conflict", [
      Code.ORGANIZATION_USER_OWNER_PROTECTED,
      Code.ORGANIZATION_USER_SELF_ACTION_NOT_ALLOWED,
      Code.ORGANIZATION_USER_LIMIT_REACHED,
    ]),
    ...globalErrorResponses,
  },
})

router.use(honoPath(setOrganizationUserStatusRoute.path), requireAuth)

router.openapi(setOrganizationUserStatusRoute, async (c) => {
  const errorTrans = trans({ lang: getRequestLocale() })
  const user = c.get("user")
  const { orgId, memberId } = c.req.valid("param")
  const body = c.req.valid("json")

  const result = await organizationUserService.setStatus(user.id, orgId, memberId, body)
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
