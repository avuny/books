import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  PlatformAuthErrorCode as AuthCode,
  PlatformCloneRoleSchema,
  PlatformManagementErrorCode as Code,
  PlatformRoleDtoSchema,
} from "@avuny/contracts/platform-admin"
import { platformManagementErrorsHttpMap as errors } from "../../platform-admin/platform-management.errors.js"
import { cloneRole } from "../platform-role.service.js"
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
  [Code.ROLE_KEY_TAKEN]: errors.ROLE_KEY_TAKEN,
  [Code.ESCALATION_DENIED]: errors.ESCALATION_DENIED,
}

/** Clones a platform role under a new key (A1-05; the way to derive from built-ins). */
export const cloneRoleRoute = ({ db, requireAuth }: PlatformAuthRouteDeps) => {
  const router = createOpenAPIRouter()
  const requirePermission = createRequirePlatformPermission(
    db,
    "create:platform-role"
  )

  const route = createRoute({
    method: "post",
    path: "/platform-roles/{roleId}/clone",
    operationId: "platformCloneRole",
    tags: ["platform-role"],
    summary: "Clone a platform role",
    middleware: [requireAuth, requirePermission] as const,
    request: {
      params: z.object({ roleId: z.string().uuid() }),
      body: {
        content: { "application/json": { schema: PlatformCloneRoleSchema } },
      },
    },
    responses: {
      201: jsonOk("The cloned role", PlatformRoleDtoSchema),
      401: jsonError("Unauthenticated", [AuthCode.UNAUTHENTICATED]),
      403: jsonError("Forbidden", [
        Code.PERMISSION_DENIED,
        Code.ESCALATION_DENIED,
      ]),
      404: jsonError("Role not found", [Code.ROLE_NOT_FOUND]),
      409: jsonError("Role key taken", [Code.ROLE_KEY_TAKEN]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const admin = c.get("platformAdmin")
    const { roleId } = c.req.valid("param")
    const result = await cloneRole(
      db,
      admin,
      roleId,
      c.req.valid("json"),
      getRequestContext(c)
    )
    return handleResult({
      c,
      result,
      successStatus: 201,
      errorMap,
      moduleName: "platform-role",
    })
  })

  return router
}

export default cloneRoleRoute
