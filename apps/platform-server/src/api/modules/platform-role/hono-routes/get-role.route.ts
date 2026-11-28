import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  PlatformAuthErrorCode as AuthCode,
  PlatformManagementErrorCode as Code,
  PlatformRoleDtoSchema,
} from "@avuny/contracts/platform-admin"
import { platformManagementErrorsHttpMap as errors } from "../../platform-admin/platform-management.errors.js"
import { getRole } from "../platform-role.service.js"
import { createRequirePlatformPermission } from "../../platform-auth/platform-auth.middleware.js"
import {
  honoPath,
  jsonError,
  jsonOk,
  type PlatformAuthRouteDeps,
} from "../../platform-auth/hono-routes/_shared.js"

const errorMap = { [Code.ROLE_NOT_FOUND]: errors.ROLE_NOT_FOUND }

/** One platform role by id (A1-05). */
export const getRoleRoute = ({ db, requireAuth }: PlatformAuthRouteDeps) => {
  const router = createOpenAPIRouter()
  const requirePermission = createRequirePlatformPermission(
    db,
    "read:platform-role"
  )

  const route = createRoute({
    method: "get",
    path: "/platform-roles/{roleId}",
    operationId: "platformGetRole",
    tags: ["platform-role"],
    summary: "Get a platform role",
    middleware: [requireAuth, requirePermission] as const,
    request: {
      params: z.object({ roleId: z.string().uuid() }),
    },
    responses: {
      200: jsonOk("The platform role", PlatformRoleDtoSchema),
      401: jsonError("Unauthenticated", [AuthCode.UNAUTHENTICATED]),
      403: jsonError("Permission denied", [Code.PERMISSION_DENIED]),
      404: jsonError("Role not found", [Code.ROLE_NOT_FOUND]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const { roleId } = c.req.valid("param")
    const result = await getRole(db, roleId)
    return handleResult({
      c,
      result,
      successStatus: 200,
      errorMap,
      moduleName: "platform-role",
    })
  })

  return router
}

export default getRoleRoute
