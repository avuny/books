import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  PlatformAdminDtoSchema,
  PlatformAuthErrorCode as AuthCode,
  PlatformManagementErrorCode as Code,
  PlatformSetAdminRolesSchema,
} from "@avuny/contracts/platform-admin"
import { platformManagementErrorsHttpMap as errors } from "../platform-management.errors.js"
import { setAdminRoles } from "../platform-admin.service.js"
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
  [Code.ADMIN_NOT_FOUND]: errors.ADMIN_NOT_FOUND,
  [Code.INVALID_ROLE_IDS]: errors.INVALID_ROLE_IDS,
  [Code.SELF_EDIT_DENIED]: errors.SELF_EDIT_DENIED,
  [Code.ESCALATION_DENIED]: errors.ESCALATION_DENIED,
  [Code.LAST_SUPER_ADMIN]: errors.LAST_SUPER_ADMIN,
}

/**
 * Replaces a platform admin's role set (A1-05). PA-R2 (no escalation), PA-R3
 * (last super admin) and PA-R4 (no self-edit) are enforced in the service.
 */
export const setAdminRolesRoute = ({ db, requireAuth }: PlatformAuthRouteDeps) => {
  const router = createOpenAPIRouter()
  const requirePermission = createRequirePlatformPermission(
    db,
    "update:platform-admin"
  )

  const route = createRoute({
    method: "put",
    path: "/platform-admins/{adminId}/roles",
    operationId: "platformSetAdminRoles",
    tags: ["platform-admin"],
    summary: "Replace a platform admin's roles",
    middleware: [requireAuth, requirePermission] as const,
    request: {
      params: z.object({ adminId: z.string().uuid() }),
      body: {
        content: { "application/json": { schema: PlatformSetAdminRolesSchema } },
      },
    },
    responses: {
      200: jsonOk("The admin with their new roles", PlatformAdminDtoSchema),
      401: jsonError("Unauthenticated", [AuthCode.UNAUTHENTICATED]),
      403: jsonError("Forbidden", [
        Code.PERMISSION_DENIED,
        Code.ESCALATION_DENIED,
      ]),
      404: jsonError("Admin not found", [Code.ADMIN_NOT_FOUND]),
      409: jsonError("Conflict", [
        Code.SELF_EDIT_DENIED,
        Code.LAST_SUPER_ADMIN,
      ]),
      422: jsonError("Unknown role", [Code.INVALID_ROLE_IDS]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const admin = c.get("platformAdmin")
    const { adminId } = c.req.valid("param")
    const { roleIds } = c.req.valid("json")
    const result = await setAdminRoles(
      db,
      admin,
      adminId,
      roleIds,
      getRequestContext(c)
    )
    return handleResult({
      c,
      result,
      successStatus: 200,
      errorMap,
      moduleName: "platform-admin",
    })
  })

  return router
}

export default setAdminRolesRoute
