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
import { getAdmin } from "../platform-admin.service.js"
import { createRequirePlatformPermission } from "../../platform-auth/platform-auth.middleware.js"
import {
  honoPath,
  jsonError,
  jsonOk,
  type PlatformAuthRouteDeps,
} from "../../platform-auth/hono-routes/_shared.js"

const errorMap = { [Code.ADMIN_NOT_FOUND]: errors.ADMIN_NOT_FOUND }

/** One platform admin by id (A1-05). */
export const getAdminRoute = ({ db, requireAuth }: PlatformAuthRouteDeps) => {
  const router = createOpenAPIRouter()
  const requirePermission = createRequirePlatformPermission(
    db,
    "read:platform-admin"
  )

  const route = createRoute({
    method: "get",
    path: "/platform-admins/{adminId}",
    operationId: "platformGetAdmin",
    tags: ["platform-admin"],
    summary: "Get a platform admin",
    middleware: [requireAuth, requirePermission] as const,
    request: {
      params: z.object({ adminId: z.string().uuid() }),
    },
    responses: {
      200: jsonOk("The platform admin", PlatformAdminDtoSchema),
      401: jsonError("Unauthenticated", [AuthCode.UNAUTHENTICATED]),
      403: jsonError("Permission denied", [Code.PERMISSION_DENIED]),
      404: jsonError("Admin not found", [Code.ADMIN_NOT_FOUND]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const { adminId } = c.req.valid("param")
    const result = await getAdmin(db, adminId)
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

export default getAdminRoute
