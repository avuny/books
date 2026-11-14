import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { itemErrorsHttpMap as errors } from "../item.errors.js"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import {
  CreateItemSchema,
  ItemDtoSchema,
  RoleErrorCode,
  ItemErrorCode as Code,
} from "@avuny/contracts"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  ITEM_BATCH_REQUIRES_TRACKING: errors.ITEM_BATCH_REQUIRES_TRACKING,
  ITEM_CATEGORY_INVALID: errors.ITEM_CATEGORY_INVALID,
  ITEM_EXPIRY_REQUIRES_BATCH_AND_TRACKING: errors.ITEM_EXPIRY_REQUIRES_BATCH_AND_TRACKING,
  ITEM_NAME_TAKEN: errors.ITEM_NAME_TAKEN,
  ITEM_OPENING_STOCK_BATCH_NOT_TRACKED: errors.ITEM_OPENING_STOCK_BATCH_NOT_TRACKED,
  ITEM_OPENING_STOCK_BATCH_REQUIRED: errors.ITEM_OPENING_STOCK_BATCH_REQUIRED,
  ITEM_OPENING_STOCK_NOT_TRACKED: errors.ITEM_OPENING_STOCK_NOT_TRACKED,
  ITEM_EXPIRY_DATE_REQUIRED: errors.ITEM_EXPIRY_DATE_REQUIRED,
  ITEM_UNIT_COLLECTION_INVALID: errors.ITEM_UNIT_COLLECTION_INVALID,
  ITEM_UNIT_INVALID: errors.ITEM_UNIT_INVALID,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const createItemRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/items",
    operationId: "createItem",
    tags: ["item"],
    summary: "Create an item (its unit collection is created automatically from a base unit)",
    middleware: [requireAuth, requirePermission("create:item")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      body: { content: { "application/json": { schema: CreateItemSchema } } },
    },
    responses: {
      201: jsonOk("Item created", ItemDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      409: jsonError("Conflict", [Code.ITEM_NAME_TAKEN]),
      422: jsonError("Invalid request", [
        Code.ITEM_CATEGORY_INVALID,
        Code.ITEM_UNIT_INVALID,
        Code.ITEM_UNIT_COLLECTION_INVALID,
        Code.ITEM_BATCH_REQUIRES_TRACKING,
        Code.ITEM_EXPIRY_REQUIRES_BATCH_AND_TRACKING,
        Code.ITEM_OPENING_STOCK_NOT_TRACKED,
        Code.ITEM_OPENING_STOCK_BATCH_REQUIRED,
        Code.ITEM_OPENING_STOCK_BATCH_NOT_TRACKED,
        Code.ITEM_EXPIRY_DATE_REQUIRED,
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
    return handleResult({
      c,
      result,
      successStatus: 201,
      errorMap,
      errorTrans,
      moduleName: "item",
    })
  })

  return router
}

export default createItemRoute
