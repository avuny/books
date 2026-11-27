import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  PlatformAdminDtoSchema,
  PlatformAuthErrorCode as AuthCode,
  PlatformManagementErrorCode as Code,
  PlatformUpdateAdminSchema,
} from "@avuny/contracts/platform-admin"
import { platformManagementErrorsHttpMap as errors } from "../platform-management.errors.js"
import { updateAdmin } from "../platform-admin.service.js"
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

const errorMap = { [Code.ADMIN_NOT_FOUND]: errors.ADMIN_NOT_FOUND }

/** Updates a platform admin's profile fields (A1-05). */
export const updateAdminRoute = ({ db, requireAuth }: PlatformAuthRouteDeps) => {
  const router = createOpenAPIRouter()
  const requirePermission = createRequirePlatformPermission(
    db,
    "update:platform-admin"
  )

  const route = createRoute({
    method: "patch",
    path: "/platform-admins/{adminId}",
    operationId: "platformUpdateAdmin",
    tags: ["platform-admin"],
    summary: "Update a platform admin",
    middleware: [requireAuth, requirePermission] as const,
    request: {
      params: z.object({ adminId: z.string().uuid() }),
      body: {
        content: { "application/json": { schema: PlatformUpdateAdminSchema } },
      },
    },
    responses: {
      200: jsonOk("The updated admin", PlatformAdminDtoSchema),
      401: jsonError("Unauthenticated", [AuthCode.UNAUTHENTICATED]),
      403: jsonError("Permission denied", [Code.PERMISSION_DENIED]),
      404: jsonError("Admin not found", [Code.ADMIN_NOT_FOUND]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const admin = c.get("platformAdmin")
    const { adminId } = c.req.valid("param")
    const result = await updateAdmin(
      db,
      admin,
      adminId,
      c.req.valid("json"),
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

export default updateAdminRoute
