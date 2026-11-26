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
  RoleErrorCode,
  ItemCategoryErrorCode as Code,
} from "@avuny/contracts"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  ITEM_CATEGORY_NOT_FOUND: errors.ITEM_CATEGORY_NOT_FOUND,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const getItemCategoryRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/item-categories/{categoryId}",
    operationId: "getItemCategory",
    tags: ["item-category"],
    summary: "Get one category",
    middleware: [requireAuth, requirePermission("read:item-category")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), categoryId: z.string().uuid() }),
    },
    responses: {
      200: jsonOk("Category retrieved", ItemCategoryDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.ITEM_CATEGORY_NOT_FOUND]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user") as { id: string } | undefined
    const { orgId, categoryId } = c.req.valid("param")

    const result = await service.getById(orgId, categoryId, user?.id)
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

export default getItemCategoryRoute
