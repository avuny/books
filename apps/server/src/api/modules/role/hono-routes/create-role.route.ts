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
import { CreateRoleSchema, RoleDtoSchema, RoleErrorCode as Code } from "@avuny/contracts"

const router = createOpenAPIRouter()

const rawErrorMap = {
  ROLE_FEATURE_NOT_AVAILABLE: errors.ROLE_FEATURE_NOT_AVAILABLE,
  ROLE_INVALID_PERMISSION: errors.ROLE_INVALID_PERMISSION,
  ROLE_NAME_TAKEN: errors.ROLE_NAME_TAKEN,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const createRoleRoute = createRoute({
  method: "post",
  path: "/organizations/{orgId}/roles",
  operationId: "createRole",
  tags: ["role"],
  summary: "Create a custom role from catalog permissions",
  middleware: [requireAuth, requirePermission("create:role")] as const,
  request: {
    params: z.object({ orgId: z.string().uuid() }),
    body: { content: { "application/json": { schema: CreateRoleSchema } } },
  },
  responses: {
    201: jsonOk("Role created", RoleDtoSchema),
    403: jsonError("Forbidden", [
      Code.ROLE_PERMISSION_DENIED,
      Code.ROLE_FEATURE_NOT_AVAILABLE,
    ]),
    409: jsonError("Name taken", [Code.ROLE_NAME_TAKEN]),
    422: jsonError("Invalid permission", [Code.ROLE_INVALID_PERMISSION]),
    ...globalErrorResponses,
  },
})

router.use(honoPath(createRoleRoute.path), requireAuth)

router.openapi(createRoleRoute, async (c) => {
  const errorTrans = trans({ lang: getRequestLocale() })
  const user = c.get("user")
  const { orgId } = c.req.valid("param")
  const body = c.req.valid("json")

  const result = await roleService.create(user.id, orgId, body)
  return handleResult({
    c,
    result,
    successStatus: 201,
    errorMap,
    errorTrans,
    moduleName: "role",
  })
})

export default router
