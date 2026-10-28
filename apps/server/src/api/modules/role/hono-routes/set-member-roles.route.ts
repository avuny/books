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
import {
  MemberRolesDtoSchema,
  RoleErrorCode as Code,
  SetMemberRolesSchema,
} from "@avuny/contracts"

const router = createOpenAPIRouter()

const rawErrorMap = {
  ROLE_MEMBER_NOT_FOUND: errors.ROLE_MEMBER_NOT_FOUND,
  ROLE_NOT_FOUND: errors.ROLE_NOT_FOUND,
  ROLE_MEMBER_NOT_ASSIGNABLE: errors.ROLE_MEMBER_NOT_ASSIGNABLE,
  ROLE_ESCALATION_NOT_ALLOWED: errors.ROLE_ESCALATION_NOT_ALLOWED,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const setMemberRolesRoute = createRoute({
  method: "put",
  path: "/organizations/{orgId}/members/{memberId}/roles",
  operationId: "setMemberRoles",
  tags: ["role"],
  summary: "Replace the roles of a managed member",
  middleware: [requireAuth, requirePermission("assign:role")] as const,
  request: {
    params: z.object({ orgId: z.string().uuid(), memberId: z.string().uuid() }),
    body: { content: { "application/json": { schema: SetMemberRolesSchema } } },
  },
  responses: {
    200: jsonOk("Member roles updated", MemberRolesDtoSchema),
    403: jsonError("Forbidden", [
      Code.ROLE_PERMISSION_DENIED,
      Code.ROLE_ESCALATION_NOT_ALLOWED,
    ]),
    404: jsonError("Not found", [Code.ROLE_MEMBER_NOT_FOUND, Code.ROLE_NOT_FOUND]),
    409: jsonError("Not assignable", [Code.ROLE_MEMBER_NOT_ASSIGNABLE]),
    ...globalErrorResponses,
  },
})

router.use(honoPath(setMemberRolesRoute.path), requireAuth)

router.openapi(setMemberRolesRoute, async (c) => {
  const errorTrans = trans({ lang: getRequestLocale() })
  const user = c.get("user")
  const { orgId, memberId } = c.req.valid("param")
  const body = c.req.valid("json")

  const result = await roleService.setMemberRoles(user.id, orgId, memberId, body)
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
