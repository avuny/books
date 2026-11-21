import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  BatchDtoSchema,
  BatchErrorCode as Code,
  BatchInputSchema,
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

export const createBatchRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/batches",
    operationId: "createBatch",
    tags: ["batch"],
    summary: "Find or create a batch for an item",
    middleware: [requireAuth, requirePermission("create:batch")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      body: {
        content: {
          "application/json": {
            schema: z
              .object({ itemId: z.string().uuid() })
              .and(BatchInputSchema),
          },
        },
      },
    },
    responses: {
      201: jsonOk("Batch created or found successfully", BatchDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      409: jsonError("Conflict", [Code.BATCH_DETAILS_CONFLICT]),
      422: jsonError("Invalid request", [
        Code.BATCH_ITEM_NOT_FOUND,
        Code.BATCH_NUMBER_INVALID,
        Code.BATCH_DATES_INVALID,
        Code.BATCH_TOO_MANY,
        Code.BATCH_SHELF_LIFE_INVALID,
      ]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const { orgId } = c.req.valid("param")
    const body = c.req.valid("json")

    const result = await service.ensureBatches(orgId, body.itemId, [
      {
        number: body.number,
        manufacturedOn: body.manufacturedOn ?? undefined,
        expiresOn: body.expiresOn ?? undefined,
        notes: body.notes ?? undefined,
        shelfLifeValue: body.shelfLifeValue ?? undefined,
        shelfLifeUnit: body.shelfLifeUnit ?? undefined,
      },
    ])

    if (!result.success) {
      return handleResult({
        c,
        result,
        successStatus: 201,
        errorMap,
        errorTrans,
        moduleName: "batch",
      })
    }

    const firstBatch = result.data[0]
    return c.json({ success: true, data: firstBatch }, 201)
  })

  return router
}

export default createBatchRoute
