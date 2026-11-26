import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  ReverseVendorBillSchema,
  VendorBillDtoSchema,
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
  VENDOR_BILL_NOT_FOUND: errors.VENDOR_BILL_NOT_FOUND,
  VENDOR_BILL_NOT_POSTED: errors.VENDOR_BILL_NOT_POSTED,
  VENDOR_BILL_POSTING_FAILED: errors.VENDOR_BILL_POSTING_FAILED,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const reverseVendorBillRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/vendor-bills/{id}/reverse",
    operationId: "reverseVendorBill",
    tags: ["vendor-bill"],
    summary: "Reverse a posted vendor bill",
    middleware: [requireAuth, requirePermission("reverse:vendor-bill")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), id: z.string().uuid() }),
      body: { content: { "application/json": { schema: ReverseVendorBillSchema } } },
    },
    responses: {
      200: jsonOk("Reverse a posted vendor bill", VendorBillDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [
        Code.VENDOR_BILL_NOT_FOUND,
      ]),
      409: jsonError("Conflict", [
        Code.VENDOR_BILL_NOT_POSTED,
        Code.VENDOR_BILL_POSTING_FAILED,
      ]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, id } = c.req.valid("param")
    const body = c.req.valid("json")

    const result = await service.reverse(user.id, orgId, id, body)
    return handleResult({ c, result, successStatus: 200, errorMap, errorTrans, moduleName: "vendor-bill" })
  })

  return router
}
