import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  BatchErrorCode as Code,
  BatchOffsetListQuerySchema,
  BatchOffsetListResponseSchema,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import { batchErrorsHttpMap as errors } from "../batch.errors.js"
import { honoPath, jsonError, jsonOk } from "./_shared.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
  BATCH_NOT_FOUND: errors.BATCH_NOT_FOUND,
  BATCH_ITEM_NOT_FOUND: errors.BATCH_ITEM_NOT_FOUND,
  BATCH_NUMBER_INVALID: errors.BATCH_NUMBER_INVALID,
  BATCH_DATES_INVALID: errors.BATCH_DATES_INVALID,
  BATCH_DETAILS_CONFLICT: errors.BATCH_DETAILS_CONFLICT,
  BATCH_TOO_MANY: errors.BATCH_TOO_MANY,
  BATCH_STATUS_UNCHANGED: errors.BATCH_STATUS_UNCHANGED,
  BATCH_SHELF_LIFE_INVALID: errors.BATCH_SHELF_LIFE_INVALID,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const listBatchesRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/batches",
    operationId: "listBatches",
    tags: ["batch"],
    summary: "List batches of an item with optional filtering and pagination",
    middleware: [requireAuth, requirePermission("read:batch")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      query: BatchOffsetListQuerySchema,
    },
    responses: {
      200: jsonOk("Batches retrieved successfully", BatchOffsetListResponseSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      422: jsonError("Invalid request", [
        Code.BATCH_NOT_FOUND,
        Code.BATCH_ITEM_NOT_FOUND,
        Code.BATCH_NUMBER_INVALID,
        Code.BATCH_DATES_INVALID,
        Code.BATCH_DETAILS_CONFLICT,
        Code.BATCH_TOO_MANY,
        Code.BATCH_STATUS_UNCHANGED,
        Code.BATCH_SHELF_LIFE_INVALID,
      ]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const { orgId } = c.req.valid("param")
    const query = c.req.valid("query")

    const result = await service.list(orgId, query)
    return handleResult({
      c,
      result,
      successStatus: 200,
      errorMap,
      errorTrans,
      moduleName: "batch",
    })
  })

  return router
}

export default listBatchesRoute
