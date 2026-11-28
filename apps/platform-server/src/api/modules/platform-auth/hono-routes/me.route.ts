import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter, handleResult } from "@avuny/hono"
import { globalErrorResponses, ok } from "@avuny/utils"
import {
  PlatformAuthErrorCode as Code,
  PlatformMeResponseSchema,
} from "@avuny/contracts/platform-admin"
import { platformAuthErrorsHttpMap as errors } from "../platform-auth.errors.js"
import { loadRoleKeys, toPlatformAdminDto } from "../platform-auth.service.js"
import { loadEffectivePermissions } from "../platform-auth.middleware.js"
import { honoPath, jsonError, jsonOk, type PlatformAuthRouteDeps } from "./_shared.js"

const errorMap = { [Code.UNAUTHENTICATED]: errors.UNAUTHENTICATED }

/** The signed-in admin's profile and role keys (A1-04). */
export const meRoute = ({ db, requireAuth }: PlatformAuthRouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/platform-auth/me",
    operationId: "platformMe",
    tags: ["platform-auth"],
    summary: "Get the signed-in admin",
    middleware: [requireAuth] as const,
    responses: {
      200: jsonOk("The signed-in admin", PlatformMeResponseSchema),
      401: jsonError("Unauthenticated", [Code.UNAUTHENTICATED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const admin = c.get("platformAdmin")
    const roleKeys = await loadRoleKeys(db, admin.id)
    const permissions = await loadEffectivePermissions(db, admin.id)
    return handleResult({
      c,
      result: ok({
        data: {
          ...toPlatformAdminDto(admin, roleKeys),
          permissions: [...permissions].sort(),
        },
      }),
      successStatus: 200,
      errorMap,
      moduleName: "platform-auth",
    })
  })

  return router
}

export default meRoute
