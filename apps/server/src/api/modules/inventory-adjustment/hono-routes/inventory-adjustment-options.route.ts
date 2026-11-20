import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  InventoryAdjustmentErrorCode as Code,
  OptionListQuerySchema,
  OptionListResponseSchema,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const inventoryAdjustmentOptionsRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/inventory-adjustments/options",
    operationId: "listInventoryAdjustmentOptions",
    tags: ["inventory-adjustment"],
    summary: "List inventory adjustment options for pickers",
    middleware: [requireAuth, requirePermission("read:inventory-adjustment")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      query: OptionListQuerySchema,
    },
    responses: {
      200: jsonOk("Inventory adjustment options retrieved", OptionListResponseSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId } = c.req.valid("param")
    const query = c.req.valid("query")

    const result = await service.listOptions(user.id, orgId, query)
    return handleResult({
      c,
      result,
      successStatus: 200,
      errorMap,
      errorTrans,
      moduleName: "inventory-adjustment",
    })
  })

  return router
}

export default inventoryAdjustmentOptionsRoute
