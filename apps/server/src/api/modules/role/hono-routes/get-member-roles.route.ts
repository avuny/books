import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { roleErrorsHttpMap as errors } from "../role.errors.js"
import { roleService } from "../role.service.js"
import { requirePermission } from "../role.middleware.js"
import { requireAuth } from "../../auth/index.js"
import { honoPath, jsonError, jsonOk } from "./_shared.js"
import { MemberRolesDtoSchema, RoleErrorCode as Code } from "@avuny/contracts"

const router = createOpenAPIRouter()

const rawErrorMap = { ROLE_MEMBER_NOT_FOUND: errors.ROLE_MEMBER_NOT_FOUND } as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const getMemberRolesRoute = createRoute({
  method: "get",
  path: "/organizations/{orgId}/members/{memberId}/roles",
  operationId: "getMemberRoles",
  tags: ["role"],
  summary: "Roles held by a member",
  middleware: [requireAuth, requirePermission("read:role")] as const,
  request: {
    params: z.object({ orgId: z.string().uuid(), memberId: z.string().uuid() }),
  },
  responses: {
    200: jsonOk("Member roles retrieved", MemberRolesDtoSchema),
    403: jsonError("Forbidden", [Code.ROLE_PERMISSION_DENIED]),
    404: jsonError("Member not found", [Code.ROLE_MEMBER_NOT_FOUND]),
    ...globalErrorResponses,
  },
})

router.use(honoPath(getMemberRolesRoute.path), requireAuth)

router.openapi(getMemberRolesRoute, async (c) => {
  const errorTrans = trans({ lang: getRequestLocale() })
  const { orgId, memberId } = c.req.valid("param")

  const result = await roleService.getMemberRoles(orgId, memberId)
  return handleResult({
    c,
    result,
    successStatus: 200,
    errorMap,
    errorTrans,
    moduleName: "role",
  })
})

export default router
