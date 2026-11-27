import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult } from "@avuny/hono"
import { globalErrorResponses, ok } from "@avuny/utils"
import {
  PlatformAuthErrorCode as AuthCode,
  PlatformManagementErrorCode as Code,
  PlatformRoleDtoSchema,
} from "@avuny/contracts/platform-admin"
import { platformManagementErrorsHttpMap as errors } from "../../platform-admin/platform-management.errors.js"
import { listRoles } from "../platform-role.service.js"
import { createRequirePlatformPermission } from "../../platform-auth/platform-auth.middleware.js"
import {
  honoPath,
  jsonError,
  jsonOk,
  type PlatformAuthRouteDeps,
} from "../../platform-auth/hono-routes/_shared.js"

const errorMap = { [Code.PERMISSION_DENIED]: errors.PERMISSION_DENIED }

/** Lists all platform roles with their grants (A1-05). */
export const listRolesRoute = ({ db, requireAuth }: PlatformAuthRouteDeps) => {
  const router = createOpenAPIRouter()
  const requirePermission = createRequirePlatformPermission(
    db,
    "read:platform-role"
  )

  const route = createRoute({
    method: "get",
    path: "/platform-roles",
    operationId: "platformListRoles",
    tags: ["platform-role"],
    summary: "List platform roles",
    middleware: [requireAuth, requirePermission] as const,
    responses: {
      200: jsonOk("All platform roles", z.array(PlatformRoleDtoSchema)),
      401: jsonError("Unauthenticated", [AuthCode.UNAUTHENTICATED]),
      403: jsonError("Permission denied", [Code.PERMISSION_DENIED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const roles = await listRoles(db)
    return handleResult({
      c,
      result: ok({ data: roles }),
      successStatus: 200,
      errorMap,
      moduleName: "platform-role",
    })
  })

  return router
}

export default listRolesRoute
