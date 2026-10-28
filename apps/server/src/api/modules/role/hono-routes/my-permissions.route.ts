import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { MyPermissionsDtoSchema, RoleErrorCode as Code } from "@avuny/contracts"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { roleErrorsHttpMap as errors } from "../role.errors.js"
import { roleService } from "../role.service.js"
import { requireAuth } from "../../auth/index.js"
import { honoPath, jsonError, jsonOk } from "./_shared.js"

const router = createOpenAPIRouter()

const rawErrorMap = { ROLE_PERMISSION_DENIED: errors.ROLE_PERMISSION_DENIED } as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

/** No requirePermission here: it is how the web app learns what the user may do. */
export const myPermissionsRoute = createRoute({
  method: "get",
  path: "/me/organizations/{orgId}/permissions",
  operationId: "getMyPermissions",
  tags: ["role"],
  summary: "My effective permissions in an organization (for sidebar / buttons)",
  middleware: [requireAuth] as const,
  request: { params: z.object({ orgId: z.string().uuid() }) },
  responses: {
    200: jsonOk("Permissions retrieved", MyPermissionsDtoSchema),
    403: jsonError("Not an active managed member or owner", [Code.ROLE_PERMISSION_DENIED]),
    ...globalErrorResponses,
  },
})

router.use(honoPath(myPermissionsRoute.path), requireAuth)

router.openapi(myPermissionsRoute, async (c) => {
  const errorTrans = trans({ lang: getRequestLocale() })
  const user = c.get("user")
  const { orgId } = c.req.valid("param")

  const result = await roleService.myPermissions(user.id, orgId)
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
