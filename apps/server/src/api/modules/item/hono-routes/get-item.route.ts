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
  RoleErrorCode,
  ItemErrorCode as Code,
} from "@avuny/contracts"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  ITEM_NOT_FOUND: errors.ITEM_NOT_FOUND,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const getItemRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/items/{itemId}",
    operationId: "getItem",
    tags: ["item"],
    summary: "Get an item with its unit, category and stock settings",
    middleware: [requireAuth, requirePermission("read:item")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), itemId: z.string().uuid() }),
    },
    responses: {
      200: jsonOk("Item retrieved", ItemDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.ITEM_NOT_FOUND]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const { orgId, itemId } = c.req.valid("param")

    const result = await service.getById(orgId, itemId)
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

export default getItemRoute
