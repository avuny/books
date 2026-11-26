import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  CreateSalesOrderSchema,
  SalesOrderDtoSchema,
  SalesOrderErrorCode as Code,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import { salesOrderErrorsHttpMap as errors } from "../sales-order.errors.js"
import type { RouteDeps } from "./module-routes.types.js"

// Keys here must match the codes declared in `responses` below; the cast only widens the key type.
const rawErrorMap = {
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
  SALES_ORDER_NUMBER_TAKEN: errors.SALES_ORDER_NUMBER_TAKEN,
  SALES_ORDER_PARTY_NOT_FOUND: errors.SALES_ORDER_PARTY_NOT_FOUND,
  SALES_ORDER_PARTY_NOT_CUSTOMER: errors.SALES_ORDER_PARTY_NOT_CUSTOMER,
  SALES_ORDER_PARTY_INACTIVE: errors.SALES_ORDER_PARTY_INACTIVE,
  SALES_ORDER_PAYMENT_TERM_NOT_FOUND: errors.SALES_ORDER_PAYMENT_TERM_NOT_FOUND,
  SALES_ORDER_PAYMENT_TERM_INACTIVE: errors.SALES_ORDER_PAYMENT_TERM_INACTIVE,
  SALES_ORDER_WAREHOUSE_REQUIRED: errors.SALES_ORDER_WAREHOUSE_REQUIRED,
  SALES_ORDER_WAREHOUSE_NOT_FOUND: errors.SALES_ORDER_WAREHOUSE_NOT_FOUND,
  SALES_ORDER_WAREHOUSE_NOT_PHYSICAL: errors.SALES_ORDER_WAREHOUSE_NOT_PHYSICAL,
  SALES_ORDER_LOCATION_NOT_FOUND: errors.SALES_ORDER_LOCATION_NOT_FOUND,
  SALES_ORDER_LOCATION_NOT_IN_WAREHOUSE: errors.SALES_ORDER_LOCATION_NOT_IN_WAREHOUSE,
  SALES_ORDER_LOCATION_NOT_STOCKABLE: errors.SALES_ORDER_LOCATION_NOT_STOCKABLE,
  SALES_ORDER_LOCATION_BLOCKED: errors.SALES_ORDER_LOCATION_BLOCKED,
  SALES_ORDER_ITEM_NOT_FOUND: errors.SALES_ORDER_ITEM_NOT_FOUND,
  SALES_ORDER_ITEM_INACTIVE: errors.SALES_ORDER_ITEM_INACTIVE,
  SALES_ORDER_ITEM_NOT_STOCKED: errors.SALES_ORDER_ITEM_NOT_STOCKED,
  SALES_ORDER_UNIT_NOT_IN_COLLECTION: errors.SALES_ORDER_UNIT_NOT_IN_COLLECTION,
  SALES_ORDER_DISCOUNT_EXCEEDS_LINE: errors.SALES_ORDER_DISCOUNT_EXCEEDS_LINE,
  SALES_ORDER_AMOUNT_OUT_OF_RANGE: errors.SALES_ORDER_AMOUNT_OUT_OF_RANGE,
  SALES_ORDER_CURRENCY_MISMATCH: errors.SALES_ORDER_CURRENCY_MISMATCH,
  SALES_ORDER_NO_LINES: errors.SALES_ORDER_NO_LINES,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const createSalesOrderRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/sales-orders",
    operationId: "createSalesOrder",
    tags: ["sales-order"],
    summary: "Create a draft sales order with lines",
    middleware: [requireAuth, requirePermission("create:sales-order")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      body: { content: { "application/json": { schema: CreateSalesOrderSchema } } },
    },
    responses: {
      201: jsonOk("Sales order created", SalesOrderDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      409: jsonError("Conflict", [
        Code.SALES_ORDER_NUMBER_TAKEN,
      ]),
      422: jsonError("Invalid request", [
        Code.SALES_ORDER_PARTY_NOT_FOUND,
        Code.SALES_ORDER_PARTY_NOT_CUSTOMER,
        Code.SALES_ORDER_PARTY_INACTIVE,
        Code.SALES_ORDER_PAYMENT_TERM_NOT_FOUND,
        Code.SALES_ORDER_PAYMENT_TERM_INACTIVE,
        Code.SALES_ORDER_WAREHOUSE_REQUIRED,
        Code.SALES_ORDER_WAREHOUSE_NOT_FOUND,
        Code.SALES_ORDER_WAREHOUSE_NOT_PHYSICAL,
        Code.SALES_ORDER_LOCATION_NOT_FOUND,
        Code.SALES_ORDER_LOCATION_NOT_IN_WAREHOUSE,
        Code.SALES_ORDER_LOCATION_NOT_STOCKABLE,
        Code.SALES_ORDER_LOCATION_BLOCKED,
        Code.SALES_ORDER_ITEM_NOT_FOUND,
        Code.SALES_ORDER_ITEM_INACTIVE,
        Code.SALES_ORDER_ITEM_NOT_STOCKED,
        Code.SALES_ORDER_UNIT_NOT_IN_COLLECTION,
        Code.SALES_ORDER_DISCOUNT_EXCEEDS_LINE,
        Code.SALES_ORDER_AMOUNT_OUT_OF_RANGE,
        Code.SALES_ORDER_CURRENCY_MISMATCH,
        Code.SALES_ORDER_NO_LINES,
      ]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId } = c.req.valid("param")
    const body = c.req.valid("json")

    const result = await service.create(user.id, orgId, body)
    return handleResult({ c, result, successStatus: 201, errorMap, errorTrans, moduleName: "sales-order" })
  })

  return router
}
