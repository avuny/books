import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  AccountingErrorCode as Code,
  AccountMappingListResponseSchema,
  RoleErrorCode,
} from "@avuny/contracts"
import { requirePermission as defaultRequirePermission } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import type { RouteDeps } from "./module-routes.types.js"

export const listAccountMappingsRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/account-mappings",
    operationId: "listAccountMappings",
    tags: ["accounting"],
    summary: "List which account plays each posting role",
    middleware: [requireAuth, requirePermission("read:accounting")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
    },
    responses: {
      200: jsonOk("Account mappings retrieved", AccountMappingListResponseSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const { orgId } = c.req.valid("param")

    const result = await service.listMappings(orgId)
    if (!result.success) throw new Error("this read cannot fail")
    return c.json({ success: true, data: result.data }, 200)
  })

  return router
}

export default listAccountMappingsRoute
