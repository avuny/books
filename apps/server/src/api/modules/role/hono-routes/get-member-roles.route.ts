import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { roleErrorsHttpMap as errors } from "../role.errors.js"
import { requirePermission as defaultRequirePermission } from "../role.middleware.js"
import { honoPath, jsonError, jsonOk } from "./_shared.js"
import { MemberRolesDtoSchema, RoleErrorCode as Code } from "@avuny/contracts"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = { ROLE_MEMBER_NOT_FOUND: errors.ROLE_MEMBER_NOT_FOUND } as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const getMemberRolesRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
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

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const { orgId, memberId } = c.req.valid("param")

    const result = await service.getMemberRoles(orgId, memberId)
    return handleResult({
      c,
      result,
      successStatus: 200,
      errorMap,
      errorTrans,
      moduleName: "role",
    })
  })

  return router
}

export default getMemberRolesRoute
