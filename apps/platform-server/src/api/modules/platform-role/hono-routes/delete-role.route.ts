import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  PlatformAuthErrorCode as AuthCode,
  PlatformManagementErrorCode as Code,
} from "@avuny/contracts/platform-admin"
import { platformManagementErrorsHttpMap as errors } from "../../platform-admin/platform-management.errors.js"
import { deleteRole } from "../platform-role.service.js"
import {
  createRequirePlatformPermission,
  getRequestContext,
} from "../../platform-auth/platform-auth.middleware.js"
import {
  honoPath,
  jsonError,
  jsonOk,
  type PlatformAuthRouteDeps,
} from "../../platform-auth/hono-routes/_shared.js"

const errorMap = {
  [Code.ROLE_NOT_FOUND]: errors.ROLE_NOT_FOUND,
  [Code.BUILTIN_ROLE_LOCKED]: errors.BUILTIN_ROLE_LOCKED,
  [Code.ROLE_IN_USE]: errors.ROLE_IN_USE,
}

/** Deletes a custom platform role (A1-05; guarded against in-use roles). */
export const deleteRoleRoute = ({ db, requireAuth }: PlatformAuthRouteDeps) => {
  const router = createOpenAPIRouter()
  const requirePermission = createRequirePlatformPermission(
    db,
    "delete:platform-role"
  )

  const route = createRoute({
    method: "delete",
    path: "/platform-roles/{roleId}",
    operationId: "platformDeleteRole",
    tags: ["platform-role"],
    summary: "Delete a platform role",
    middleware: [requireAuth, requirePermission] as const,
    request: {
      params: z.object({ roleId: z.string().uuid() }),
    },
    responses: {
      200: jsonOk("Role deleted", z.null()),
      401: jsonError("Unauthenticated", [AuthCode.UNAUTHENTICATED]),
      403: jsonError("Permission denied", [Code.PERMISSION_DENIED]),
      404: jsonError("Role not found", [Code.ROLE_NOT_FOUND]),
      409: jsonError("Conflict", [
        Code.BUILTIN_ROLE_LOCKED,
        Code.ROLE_IN_USE,
      ]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const admin = c.get("platformAdmin")
    const { roleId } = c.req.valid("param")
    const result = await deleteRole(db, admin, roleId, getRequestContext(c))
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

export default deleteRoleRoute
