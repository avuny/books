import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { roleErrorsHttpMap as errors } from "../role.errors.js"
import { requirePermission as defaultRequirePermission } from "../role.middleware.js"
import { honoPath, jsonError, jsonOk } from "./_shared.js"
import { DeleteRoleResponseSchema, RoleErrorCode as Code } from "@avuny/contracts"
import type { RouteDeps } from "./module-routes.types.js"

const errorMap = {
  ROLE_NOT_FOUND: errors.ROLE_NOT_FOUND,
  ROLE_SYSTEM_READONLY: errors.ROLE_SYSTEM_READONLY,
  ROLE_IN_USE: errors.ROLE_IN_USE,
} as Record<Code, { statusCode: 404 | 409; responseMessage: string }>

export const deleteRoleRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "delete",
    path: "/organizations/{orgId}/roles/{roleId}",
    operationId: "deleteRole",
    tags: ["role"],
    summary: "Delete a custom role that is not assigned to anyone",
    middleware: [requireAuth, requirePermission("delete:role")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), roleId: z.string().uuid() }),
    },
    responses: {
      200: jsonOk("Role deleted", DeleteRoleResponseSchema),
      403: jsonError("Forbidden", [Code.ROLE_PERMISSION_DENIED]),
      404: jsonError("Role not found", [Code.ROLE_NOT_FOUND]),
      409: jsonError("Conflict", [Code.ROLE_SYSTEM_READONLY, Code.ROLE_IN_USE]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, roleId } = c.req.valid("param")

    const result = await service.remove(user.id, orgId, roleId)
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

export default deleteRoleRoute
