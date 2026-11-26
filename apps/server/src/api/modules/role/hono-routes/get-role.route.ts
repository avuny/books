import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { roleErrorsHttpMap as errors } from "../role.errors.js"
import { requirePermission as defaultRequirePermission } from "../role.middleware.js"
import { honoPath, jsonError, jsonOk } from "./_shared.js"
import { RoleDtoSchema, RoleErrorCode as Code } from "@avuny/contracts"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = { ROLE_NOT_FOUND: errors.ROLE_NOT_FOUND } as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const getRoleRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/roles/{roleId}",
    operationId: "getRole",
    tags: ["role"],
    summary: "Get a role with its permissions",
    middleware: [requireAuth, requirePermission("read:role")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), roleId: z.string().uuid() }),
    },
    responses: {
      200: jsonOk("Role retrieved", RoleDtoSchema),
      403: jsonError("Forbidden", [Code.ROLE_PERMISSION_DENIED]),
      404: jsonError("Role not found", [Code.ROLE_NOT_FOUND]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const { orgId, roleId } = c.req.valid("param")

    const result = await service.getById(orgId, roleId)
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

export default getRoleRoute
