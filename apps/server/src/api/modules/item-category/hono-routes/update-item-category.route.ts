import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { itemCategoryErrorsHttpMap as errors } from "../item-category.errors.js"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import {
  ItemCategoryDtoSchema,
  UpdateItemCategorySchema,
  RoleErrorCode,
  ItemCategoryErrorCode as Code,
} from "@avuny/contracts"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  ITEM_CATEGORY_CYCLE: errors.ITEM_CATEGORY_CYCLE,
  ITEM_CATEGORY_MAX_DEPTH_EXCEEDED: errors.ITEM_CATEGORY_MAX_DEPTH_EXCEEDED,
  ITEM_CATEGORY_NAME_TAKEN: errors.ITEM_CATEGORY_NAME_TAKEN,
  ITEM_CATEGORY_NOT_FOUND: errors.ITEM_CATEGORY_NOT_FOUND,
  ITEM_CATEGORY_PARENT_NOT_FOUND: errors.ITEM_CATEGORY_PARENT_NOT_FOUND,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const updateItemCategoryRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "patch",
    path: "/organizations/{orgId}/item-categories/{categoryId}",
    operationId: "updateItemCategory",
    tags: ["item-category"],
    summary: "Rename, move, describe or (de)activate a category",
    middleware: [requireAuth, requirePermission("update:item-category")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), categoryId: z.string().uuid() }),
      body: { content: { "application/json": { schema: UpdateItemCategorySchema } } },
    },
    responses: {
      200: jsonOk("Category updated", ItemCategoryDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.ITEM_CATEGORY_NOT_FOUND]),
      409: jsonError("Conflict", [Code.ITEM_CATEGORY_NAME_TAKEN]),
      422: jsonError("Invalid request", [Code.ITEM_CATEGORY_PARENT_NOT_FOUND, Code.ITEM_CATEGORY_CYCLE, Code.ITEM_CATEGORY_MAX_DEPTH_EXCEEDED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, categoryId } = c.req.valid("param")
    const body = c.req.valid("json")

    const result = await service.update(user.id, orgId, categoryId, body)
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

export default updateItemCategoryRoute
