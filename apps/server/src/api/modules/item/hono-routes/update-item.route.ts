import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { itemErrorsHttpMap as errors } from "../item.errors.js"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import {
  ItemDtoSchema,
  UpdateItemSchema,
  RoleErrorCode,
  ItemErrorCode as Code,
} from "@avuny/contracts"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  ITEM_BATCH_REQUIRES_TRACKING: errors.ITEM_BATCH_REQUIRES_TRACKING,
  ITEM_CATEGORY_INVALID: errors.ITEM_CATEGORY_INVALID,
  ITEM_EXPIRY_REQUIRES_BATCH_AND_TRACKING: errors.ITEM_EXPIRY_REQUIRES_BATCH_AND_TRACKING,
  ITEM_LOCKED_FIELD: errors.ITEM_LOCKED_FIELD,
  ITEM_NAME_TAKEN: errors.ITEM_NAME_TAKEN,
  ITEM_NOT_FOUND: errors.ITEM_NOT_FOUND,
  ITEM_UNIT_COLLECTION_INVALID: errors.ITEM_UNIT_COLLECTION_INVALID,
  ITEM_UNIT_INVALID: errors.ITEM_UNIT_INVALID,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const updateItemRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "patch",
    path: "/organizations/{orgId}/items/{itemId}",
    operationId: "updateItem",
    tags: ["item"],
    summary: "Update an item (unit and tracking fields lock once it has stock movements)",
    middleware: [requireAuth, requirePermission("update:item")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), itemId: z.string().uuid() }),
      body: { content: { "application/json": { schema: UpdateItemSchema } } },
    },
    responses: {
      200: jsonOk("Item updated", ItemDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.ITEM_NOT_FOUND]),
      409: jsonError("Conflict", [Code.ITEM_NAME_TAKEN, Code.ITEM_LOCKED_FIELD]),
      422: jsonError("Invalid request", [
        Code.ITEM_CATEGORY_INVALID,
        Code.ITEM_UNIT_INVALID,
        Code.ITEM_UNIT_COLLECTION_INVALID,
        Code.ITEM_BATCH_REQUIRES_TRACKING,
        Code.ITEM_EXPIRY_REQUIRES_BATCH_AND_TRACKING,
      ]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, itemId } = c.req.valid("param")
    const body = c.req.valid("json")

    const result = await service.update(user.id, orgId, itemId, body)
    return handleResult({
      c,
      result,
      successStatus: 200,
      errorMap,
      errorTrans,
      moduleName: "item",
    })
  })

  return router
}

export default updateItemRoute
