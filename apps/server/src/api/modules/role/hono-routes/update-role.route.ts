import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { roleErrorsHttpMap as errors } from "../role.errors.js"
import { roleService } from "../role.service.js"
import { requirePermission } from "../role.middleware.js"
import { requireAuth } from "../../auth/index.js"
import { honoPath, jsonError, jsonOk } from "./_shared.js"
import { RoleDtoSchema, RoleErrorCode as Code, UpdateRoleSchema } from "@avuny/contracts"

const router = createOpenAPIRouter()

const rawErrorMap = {
  ROLE_NOT_FOUND: errors.ROLE_NOT_FOUND,
  ROLE_SYSTEM_READONLY: errors.ROLE_SYSTEM_READONLY,
  ROLE_NAME_TAKEN: errors.ROLE_NAME_TAKEN,
  ROLE_FEATURE_NOT_AVAILABLE: errors.ROLE_FEATURE_NOT_AVAILABLE,
  ROLE_INVALID_PERMISSION: errors.ROLE_INVALID_PERMISSION,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const updateRoleRoute = createRoute({
  method: "patch",
  path: "/organizations/{orgId}/roles/{roleId}",
  operationId: "updateRole",
  tags: ["role"],
  summary: "Rename a custom role or replace its permissions",
  middleware: [requireAuth, requirePermission("update:role")] as const,
  request: {
    params: z.object({ orgId: z.string().uuid(), roleId: z.string().uuid() }),
    body: { content: { "application/json": { schema: UpdateRoleSchema } } },
  },
  responses: {
    200: jsonOk("Role updated", RoleDtoSchema),
    403: jsonError("Forbidden", [
      Code.ROLE_PERMISSION_DENIED,
      Code.ROLE_FEATURE_NOT_AVAILABLE,
    ]),
    404: jsonError("Role not found", [Code.ROLE_NOT_FOUND]),
    409: jsonError("Conflict", [Code.ROLE_SYSTEM_READONLY, Code.ROLE_NAME_TAKEN]),
    422: jsonError("Invalid permission", [Code.ROLE_INVALID_PERMISSION]),
    ...globalErrorResponses,
  },
})

router.use(honoPath(updateRoleRoute.path), requireAuth)

router.openapi(updateRoleRoute, async (c) => {
  const errorTrans = trans({ lang: getRequestLocale() })
  const user = c.get("user")
  const { orgId, roleId } = c.req.valid("param")
  const body = c.req.valid("json")

  const result = await roleService.update(user.id, orgId, roleId, body)
  return handleResult({
    c,
    result,
    successStatus: 200,
    errorMap,
    errorTrans,
    moduleName: "role",
  })
})

export default router
