import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  AccountingErrorCode as Code,
  BalanceSheetQuerySchema,
  BalanceSheetResponseSchema,
  RoleErrorCode,
} from "@avuny/contracts"
import { requirePermission as defaultRequirePermission } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import type { RouteDeps } from "./module-routes.types.js"

export const balanceSheetRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/reports/balance-sheet",
    operationId: "getBalanceSheet",
    tags: ["accounting"],
    summary: "Balance sheet as of a date from posted journal entries",
    middleware: [requireAuth, requirePermission("read:accounting")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      query: BalanceSheetQuerySchema,
    },
    responses: {
      200: jsonOk("Balance sheet retrieved", BalanceSheetResponseSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const { orgId } = c.req.valid("param")
    const query = c.req.valid("query")

    const result = await service.getBalanceSheet(orgId, query)
    if (!result.success) throw new Error("this read cannot fail")
    return c.json({ success: true, data: result.data }, 200)
  })

  return router
}

export default balanceSheetRoute
