import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  SalesDeliveryDtoSchema,
  SalesDeliveryErrorCode as Code,
  RoleErrorCode,
  UpdateSalesDeliverySchema,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import { salesDeliveryErrorsHttpMap as errors } from "../sales-delivery.errors.js"
import type { RouteDeps } from "./module-routes.types.js"

// Keys here must match the codes declared in `responses` below; the cast only widens the key type.
const rawErrorMap = {
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
  SALES_DELIVERY_NOT_FOUND: errors.SALES_DELIVERY_NOT_FOUND,
  SALES_DELIVERY_NOT_EDITABLE: errors.SALES_DELIVERY_NOT_EDITABLE,
  SALES_DELIVERY_SALES_ORDER_NOT_FOUND: errors.SALES_DELIVERY_SALES_ORDER_NOT_FOUND,
  SALES_DELIVERY_SALES_ORDER_NOT_OPEN: errors.SALES_DELIVERY_SALES_ORDER_NOT_OPEN,
  SALES_DELIVERY_LINE_NOT_ON_ORDER: errors.SALES_DELIVERY_LINE_NOT_ON_ORDER,
  SALES_DELIVERY_DUPLICATE_LINES: errors.SALES_DELIVERY_DUPLICATE_LINES,
  SALES_DELIVERY_UNIT_NOT_IN_COLLECTION: errors.SALES_DELIVERY_UNIT_NOT_IN_COLLECTION,
  SALES_DELIVERY_QUANTITY_NOT_POSITIVE: errors.SALES_DELIVERY_QUANTITY_NOT_POSITIVE,
  SALES_DELIVERY_EXCEEDS_OPEN: errors.SALES_DELIVERY_EXCEEDS_OPEN,
  SALES_DELIVERY_LOCATION_INVALID: errors.SALES_DELIVERY_LOCATION_INVALID,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const updateSalesDeliveryRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "patch",
    path: "/organizations/{orgId}/sales-deliveries/{id}",
    operationId: "updateSalesDelivery",
    tags: ["sales-delivery"],
    summary: "Update a draft delivery",
    middleware: [requireAuth, requirePermission("update:sales-delivery")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), id: z.string().uuid() }),
      body: { content: { "application/json": { schema: UpdateSalesDeliverySchema } } },
    },
    responses: {
      200: jsonOk("Delivery updated", SalesDeliveryDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [
        Code.SALES_DELIVERY_NOT_FOUND,
        Code.SALES_DELIVERY_SALES_ORDER_NOT_FOUND,
      ]),
      409: jsonError("Conflict", [
        Code.SALES_DELIVERY_EXCEEDS_OPEN,
        Code.SALES_DELIVERY_NOT_EDITABLE,
        Code.SALES_DELIVERY_SALES_ORDER_NOT_OPEN,
      ]),
      422: jsonError("Invalid request", [
        Code.SALES_DELIVERY_LOCATION_INVALID,
        Code.SALES_DELIVERY_LINE_NOT_ON_ORDER,
        Code.SALES_DELIVERY_DUPLICATE_LINES,
        Code.SALES_DELIVERY_UNIT_NOT_IN_COLLECTION,
        Code.SALES_DELIVERY_QUANTITY_NOT_POSITIVE,
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

    const result = await service.update(user.id, orgId, id, body)
    return handleResult({ c, result, successStatus: 200, errorMap, errorTrans, moduleName: "sales-delivery" })
  })

  return router
}
