import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  PlatformAuthErrorCode as AuthCode,
  PlatformCreateRoleSchema,
  PlatformManagementErrorCode as Code,
  PlatformRoleDtoSchema,
} from "@avuny/contracts/platform-admin"
import { platformManagementErrorsHttpMap as errors } from "../../platform-admin/platform-management.errors.js"
import { createRole } from "../platform-role.service.js"
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
  [Code.INVALID_PERMISSIONS]: errors.INVALID_PERMISSIONS,
  [Code.ROLE_KEY_TAKEN]: errors.ROLE_KEY_TAKEN,
  [Code.ESCALATION_DENIED]: errors.ESCALATION_DENIED,
}

/** Creates a custom platform role (A1-05). */
export const createRoleRoute = ({ db, requireAuth }: PlatformAuthRouteDeps) => {
  const router = createOpenAPIRouter()
  const requirePermission = createRequirePlatformPermission(
    db,
    "create:platform-role"
  )

  const route = createRoute({
    method: "post",
    path: "/platform-roles",
    operationId: "platformCreateRole",
    tags: ["platform-role"],
    summary: "Create a platform role",
    middleware: [requireAuth, requirePermission] as const,
    request: {
      body: {
        content: { "application/json": { schema: PlatformCreateRoleSchema } },
      },
    },
    responses: {
      201: jsonOk("The created role", PlatformRoleDtoSchema),
      401: jsonError("Unauthenticated", [AuthCode.UNAUTHENTICATED]),
      403: jsonError("Forbidden", [
        Code.PERMISSION_DENIED,
        Code.ESCALATION_DENIED,
      ]),
      409: jsonError("Role key taken", [Code.ROLE_KEY_TAKEN]),
      422: jsonError("Unknown permission", [Code.INVALID_PERMISSIONS]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const admin = c.get("platformAdmin")
    const result = await createRole(
      db,
      admin,
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

export default createRoleRoute
