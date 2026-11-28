import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter, handleResult } from "@avuny/hono"
import { globalErrorResponses, ok } from "@avuny/utils"
import {
  PlatformAdminListQuerySchema,
  PlatformAdminListResponseSchema,
  PlatformAuthErrorCode as AuthCode,
  PlatformManagementErrorCode as Code,
} from "@avuny/contracts/platform-admin"
import { platformManagementErrorsHttpMap as errors } from "../platform-management.errors.js"
import { listAdmins } from "../platform-admin.service.js"
import { createRequirePlatformPermission } from "../../platform-auth/platform-auth.middleware.js"
import {
  honoPath,
  jsonError,
  jsonOk,
  type PlatformAuthRouteDeps,
} from "../../platform-auth/hono-routes/_shared.js"

const errorMap = { [Code.PERMISSION_DENIED]: errors.PERMISSION_DENIED }

/** Lists platform admins, keyset-paginated (A1-05). */
export const listAdminsRoute = ({ db, requireAuth }: PlatformAuthRouteDeps) => {
  const router = createOpenAPIRouter()
  const requirePermission = createRequirePlatformPermission(
    db,
    "read:platform-admin"
  )

  const route = createRoute({
    method: "get",
    path: "/platform-admins",
    operationId: "platformListAdmins",
    tags: ["platform-admin"],
    summary: "List platform admins",
    middleware: [requireAuth, requirePermission] as const,
    request: { query: PlatformAdminListQuerySchema },
    responses: {
      200: jsonOk("Page of platform admins", PlatformAdminListResponseSchema),
      401: jsonError("Unauthenticated", [AuthCode.UNAUTHENTICATED]),
      403: jsonError("Permission denied", [Code.PERMISSION_DENIED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const admins = await listAdmins(db, c.req.valid("query"))
    return handleResult({
      c,
      result: ok({ data: admins }),
      successStatus: 200,
      errorMap,
      moduleName: "platform-admin",
    })
  })

  return router
}

export default listAdminsRoute
