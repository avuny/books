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
import {
  RoleErrorCode as Code,
  RoleOffsetListQuerySchema,
  RoleOffsetListResponseSchema,
} from "@avuny/contracts"

const router = createOpenAPIRouter()

export const roleListRoute = createRoute({
  method: "get",
  path: "/organizations/{orgId}/roles",
  operationId: "listRoles",
  tags: ["role"],
  summary: "List system roles and the organization's custom roles",
  middleware: [requireAuth, requirePermission("read:role")] as const,
  request: {
    params: z.object({ orgId: z.string().uuid() }),
    query: RoleOffsetListQuerySchema,
  },
  responses: {
    200: jsonOk("Roles retrieved", RoleOffsetListResponseSchema),
    403: jsonError("Forbidden", [Code.ROLE_PERMISSION_DENIED]),
    ...globalErrorResponses,
  },
})

router.use(honoPath(roleListRoute.path), requireAuth)

router.openapi(roleListRoute, async (c) => {
  const { orgId } = c.req.valid("param")
  const query = c.req.valid("query")
  const result = await roleService.list(orgId, query)
  if (!result.success) throw new Error("list cannot fail")
  return c.json({ success: true, data: result.data }, 200)
})

export default router
