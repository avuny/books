import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  PlatformAdminDtoSchema,
  PlatformAuthErrorCode as AuthCode,
  PlatformManagementErrorCode as Code,
} from "@avuny/contracts/platform-admin"
import { platformManagementErrorsHttpMap as errors } from "../platform-management.errors.js"
import { disableAdmin } from "../platform-admin.service.js"
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
  [Code.SELF_EDIT_DENIED]: errors.SELF_EDIT_DENIED,
  [Code.LAST_SUPER_ADMIN]: errors.LAST_SUPER_ADMIN,
}

/** Disables a platform admin and revokes their sessions (A1-05). */
export const disableAdminRoute = ({ db, requireAuth }: PlatformAuthRouteDeps) => {
  const router = createOpenAPIRouter()
  const requirePermission = createRequirePlatformPermission(
    db,
    "disable:platform-admin"
  )

  const route = createRoute({
    method: "post",
    path: "/platform-admins/{adminId}/disable",
    operationId: "platformDisableAdmin",
    tags: ["platform-admin"],
    summary: "Disable a platform admin",
    middleware: [requireAuth, requirePermission] as const,
    request: {
      params: z.object({ adminId: z.string().uuid() }),
    },
    responses: {
      200: jsonOk("The disabled admin", PlatformAdminDtoSchema),
      401: jsonError("Unauthenticated", [AuthCode.UNAUTHENTICATED]),
      403: jsonError("Permission denied", [Code.PERMISSION_DENIED]),
      404: jsonError("Admin not found", [Code.ADMIN_NOT_FOUND]),
      409: jsonError("Conflict", [
        Code.SELF_EDIT_DENIED,
        Code.LAST_SUPER_ADMIN,
      ]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const admin = c.get("platformAdmin")
    const { adminId } = c.req.valid("param")
    const result = await disableAdmin(db, admin, adminId, getRequestContext(c))
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

export default disableAdminRoute
