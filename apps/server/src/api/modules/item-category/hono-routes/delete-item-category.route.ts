import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { itemCategoryErrorsHttpMap as errors } from "../item-category.errors.js"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import {
  DeleteItemCategoryResponseSchema,
  RoleErrorCode,
  ItemCategoryErrorCode as Code,
} from "@avuny/contracts"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  ITEM_CATEGORY_IN_USE: errors.ITEM_CATEGORY_IN_USE,
  ITEM_CATEGORY_NOT_FOUND: errors.ITEM_CATEGORY_NOT_FOUND,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const deleteItemCategoryRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "delete",
    path: "/organizations/{orgId}/item-categories/{categoryId}",
    operationId: "deleteItemCategory",
    tags: ["item-category"],
    summary: "Delete an unused leaf category",
    middleware: [requireAuth, requirePermission("delete:item-category")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), categoryId: z.string().uuid() }),
    },
    responses: {
      200: jsonOk("Category deleted", DeleteItemCategoryResponseSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.ITEM_CATEGORY_NOT_FOUND]),
      409: jsonError("Conflict", [Code.ITEM_CATEGORY_IN_USE]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, categoryId } = c.req.valid("param")

    const result = await service.remove(user.id, orgId, categoryId)
    return handleResult({
      c,
      result,
      successStatus: 200,
      errorMap,
      errorTrans,
      moduleName: "item-category",
    })
  })

  return router
}

export default deleteItemCategoryRoute
