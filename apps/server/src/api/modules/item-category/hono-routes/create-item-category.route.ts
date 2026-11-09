import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { itemCategoryErrorsHttpMap as errors } from "../item-category.errors.js"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import {
  CreateItemCategorySchema,
  ItemCategoryDtoSchema,
  RoleErrorCode,
  ItemCategoryErrorCode as Code,
} from "@avuny/contracts"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  ITEM_CATEGORY_MAX_DEPTH_EXCEEDED: errors.ITEM_CATEGORY_MAX_DEPTH_EXCEEDED,
  ITEM_CATEGORY_NAME_TAKEN: errors.ITEM_CATEGORY_NAME_TAKEN,
  ITEM_CATEGORY_PARENT_NOT_FOUND: errors.ITEM_CATEGORY_PARENT_NOT_FOUND,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const createItemCategoryRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/item-categories",
    operationId: "createItemCategory",
    tags: ["item-category"],
    summary: "Create a category, optionally under a parent",
    middleware: [requireAuth, requirePermission("create:item-category")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      body: { content: { "application/json": { schema: CreateItemCategorySchema } } },
    },
    responses: {
      201: jsonOk("Category created", ItemCategoryDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      409: jsonError("Conflict", [Code.ITEM_CATEGORY_NAME_TAKEN]),
      422: jsonError("Invalid request", [Code.ITEM_CATEGORY_PARENT_NOT_FOUND, Code.ITEM_CATEGORY_MAX_DEPTH_EXCEEDED]),
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
      moduleName: "item-category",
    })
  })

  return router
}

export default createItemCategoryRoute
