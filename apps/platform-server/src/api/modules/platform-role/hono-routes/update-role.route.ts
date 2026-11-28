import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  PlatformAuthErrorCode as AuthCode,
  PlatformManagementErrorCode as Code,
  PlatformRoleDtoSchema,
  PlatformUpdateRoleSchema,
} from "@avuny/contracts/platform-admin"
import { platformManagementErrorsHttpMap as errors } from "../../platform-admin/platform-management.errors.js"
import { updateRole } from "../platform-role.service.js"
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
  [Code.INVALID_PERMISSIONS]: errors.INVALID_PERMISSIONS,
  [Code.ESCALATION_DENIED]: errors.ESCALATION_DENIED,
}

/** Updates a custom platform role (A1-05; PA-R5 locks built-ins). */
export const updateRoleRoute = ({ db, requireAuth }: PlatformAuthRouteDeps) => {
  const router = createOpenAPIRouter()
  const requirePermission = createRequirePlatformPermission(
    db,
    "update:platform-role"
  )

  const route = createRoute({
    method: "patch",
    path: "/platform-roles/{roleId}",
    operationId: "platformUpdateRole",
    tags: ["platform-role"],
    summary: "Update a platform role",
    middleware: [requireAuth, requirePermission] as const,
    request: {
      params: z.object({ roleId: z.string().uuid() }),
      body: {
        content: { "application/json": { schema: PlatformUpdateRoleSchema } },
      },
    },
    responses: {
      200: jsonOk("The updated role", PlatformRoleDtoSchema),
      401: jsonError("Unauthenticated", [AuthCode.UNAUTHENTICATED]),
      403: jsonError("Forbidden", [
        Code.PERMISSION_DENIED,
        Code.ESCALATION_DENIED,
      ]),
      404: jsonError("Role not found", [Code.ROLE_NOT_FOUND]),
      409: jsonError("Built-in role locked", [Code.BUILTIN_ROLE_LOCKED]),
      422: jsonError("Unknown permission", [Code.INVALID_PERMISSIONS]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const admin = c.get("platformAdmin")
    const { roleId } = c.req.valid("param")
    const result = await updateRole(
      db,
      admin,
      roleId,
      c.req.valid("json"),
      getRequestContext(c)
    )
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

export default updateRoleRoute
