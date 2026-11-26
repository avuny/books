import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  SupplierStatementResponseSchema,
  SupplierStatementQuerySchema,
  VendorBillErrorCode as Code,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import { vendorBillErrorsHttpMap as errors } from "../vendor-bill.errors.js"
import type { RouteDeps } from "./module-routes.types.js"

// Keys here must match the codes declared in `responses` below; the cast only widens the key type.
const rawErrorMap = {
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
  VENDOR_BILL_SUPPLIER_NOT_FOUND: errors.VENDOR_BILL_SUPPLIER_NOT_FOUND,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const supplierStatementRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/ap-reports/supplier-statement",
    operationId: "getSupplierStatement",
    tags: ["vendor-bill"],
    summary: "Supplier statement",
    middleware: [requireAuth, requirePermission("read:vendor-bill")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      query: SupplierStatementQuerySchema,
    },
    responses: {
      200: jsonOk("Supplier statement", SupplierStatementResponseSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.VENDOR_BILL_SUPPLIER_NOT_FOUND]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId } = c.req.valid("param")
    const query = c.req.valid("query")

    const result = await service.supplierStatement(user.id, orgId, query)
    return handleResult({ c, result, successStatus: 200, errorMap, errorTrans, moduleName: "vendor-bill" })
  })

  return router
}
