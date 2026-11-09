import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { itemErrorsHttpMap as errors } from "../item.errors.js"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import {
  DeleteItemResponseSchema,
  RoleErrorCode,
  ItemErrorCode as Code,
} from "@avuny/contracts"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  ITEM_HAS_HISTORY: errors.ITEM_HAS_HISTORY,
  ITEM_NOT_FOUND: errors.ITEM_NOT_FOUND,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const deleteItemRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "delete",
    path: "/organizations/{orgId}/items/{itemId}",
    operationId: "deleteItem",
    tags: ["item"],
    summary: "Delete an item that has no stock history (otherwise deactivate it)",
    middleware: [requireAuth, requirePermission("delete:item")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), itemId: z.string().uuid() }),
    },
    responses: {
      200: jsonOk("Item deleted", DeleteItemResponseSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.ITEM_NOT_FOUND]),
      409: jsonError("Conflict", [Code.ITEM_HAS_HISTORY]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, itemId } = c.req.valid("param")

    const result = await service.remove(user.id, orgId, itemId)
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

export default deleteItemRoute
