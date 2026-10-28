import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import {
  OrganizationUserErrorCode as Code,
  TouchMembershipResponseSchema,
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
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const touchOrganizationMembershipRoute = createRoute({
  method: "post",
  path: "/me/organizations/{orgId}/touch",
  operationId: "touchOrganizationMembership",
  tags: ["organization-user"],
  summary: "Mark an organization as most recently used by the current user",
  middleware: [requireAuth] as const,
  request: { params: z.object({ orgId: z.string().uuid() }) },
  responses: {
    200: jsonOk("Membership touched", TouchMembershipResponseSchema),
    404: jsonError("Not a member", [Code.ORGANIZATION_USER_NOT_FOUND]),
    ...globalErrorResponses,
  },
})

router.use(honoPath(touchOrganizationMembershipRoute.path), requireAuth)

router.openapi(touchOrganizationMembershipRoute, async (c) => {
  const errorTrans = trans({ lang: getRequestLocale() })
  const user = c.get("user")
  const { orgId } = c.req.valid("param")

  const result = await organizationUserService.touch(user.id, orgId)
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
