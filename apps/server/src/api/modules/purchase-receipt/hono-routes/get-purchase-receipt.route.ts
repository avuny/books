import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  PurchaseReceiptDtoSchema,
  PurchaseReceiptErrorCode as Code,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import { purchaseReceiptErrorsHttpMap as errors } from "../purchase-receipt.errors.js"
import type { RouteDeps } from "./module-routes.types.js"

// Keys here must match the codes declared in `responses` below; the cast only widens the key type.
const rawErrorMap = {
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
  PURCHASE_RECEIPT_NOT_FOUND: errors.PURCHASE_RECEIPT_NOT_FOUND,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const getPurchaseReceiptRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/purchase-receipts/{id}",
    operationId: "getPurchaseReceipt",
    tags: ["purchase-receipt"],
    summary: "Get a receipt with lines",
    middleware: [requireAuth, requirePermission("read:purchase-receipt")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), id: z.string().uuid() }),
    },
    responses: {
      200: jsonOk("Receipt retrieved", PurchaseReceiptDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [
        Code.PURCHASE_RECEIPT_NOT_FOUND,
      ]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, id } = c.req.valid("param")

    const result = await service.get(user.id, orgId, id)
    return handleResult({ c, result, successStatus: 200, errorMap, errorTrans, moduleName: "purchase-receipt" })
  })

  return router
}
