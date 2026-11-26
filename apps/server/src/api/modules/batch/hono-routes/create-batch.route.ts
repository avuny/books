import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses, ok } from "@avuny/utils"
import {
  BatchDtoSchema,
  BatchErrorCode as Code,
  BatchInputSchema,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { batchErrorsHttpMap as errors } from "../batch.errors.js"
import { honoPath, jsonError, jsonOk } from "./_shared.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  BATCH_NOT_FOUND: errors.BATCH_NOT_FOUND,
  BATCH_ITEM_NOT_FOUND: errors.BATCH_ITEM_NOT_FOUND,
  BATCH_NUMBER_INVALID: errors.BATCH_NUMBER_INVALID,
  BATCH_DATES_INVALID: errors.BATCH_DATES_INVALID,
  BATCH_DETAILS_CONFLICT: errors.BATCH_DETAILS_CONFLICT,
  BATCH_TOO_MANY: errors.BATCH_TOO_MANY,
  BATCH_STATUS_UNCHANGED: errors.BATCH_STATUS_UNCHANGED,
  BATCH_SHELF_LIFE_INVALID: errors.BATCH_SHELF_LIFE_INVALID,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

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
      404: jsonError("Not found", [Code.BATCH_ITEM_NOT_FOUND, Code.BATCH_NOT_FOUND]),
      409: jsonError("Conflict", [Code.BATCH_DETAILS_CONFLICT]),
      422: jsonError("Invalid request", [
        Code.BATCH_NUMBER_INVALID,
        Code.BATCH_DATES_INVALID,
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

    const singleResult = result.success
      ? ok({ data: result.data[0]! })
      : result

    return handleResult({
      c,
      result: singleResult,
      successStatus: 201,
      errorMap,
      errorTrans,
      moduleName: "batch",
    })
  })

  return router
}

export default createBatchRoute
