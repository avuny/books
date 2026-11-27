import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  SalesCreditNoteDtoSchema,
  SalesCreditNoteErrorCode as Code,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import { salesCreditNoteErrorsHttpMap as errors } from "../sales-credit-note.errors.js"
import type { RouteDeps } from "./module-routes.types.js"

// Keys here must match the codes declared in `responses` below; the cast only widens the key type.
const rawErrorMap = {
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
  SALES_CREDIT_NOTE_NOT_FOUND: errors.SALES_CREDIT_NOTE_NOT_FOUND,
  SALES_CREDIT_NOTE_ALREADY_POSTED: errors.SALES_CREDIT_NOTE_ALREADY_POSTED,
  SALES_CREDIT_NOTE_NOT_EDITABLE: errors.SALES_CREDIT_NOTE_NOT_EDITABLE,
  SALES_CREDIT_NOTE_POSTING_FAILED: errors.SALES_CREDIT_NOTE_POSTING_FAILED,
  SALES_CREDIT_NOTE_INVOICE_NOT_FOUND: errors.SALES_CREDIT_NOTE_INVOICE_NOT_FOUND,
  SALES_CREDIT_NOTE_INVOICE_NOT_POSTED: errors.SALES_CREDIT_NOTE_INVOICE_NOT_POSTED,
  SALES_CREDIT_NOTE_AMOUNT_NOT_POSITIVE: errors.SALES_CREDIT_NOTE_AMOUNT_NOT_POSITIVE,
  SALES_CREDIT_NOTE_EXCEEDS_OUTSTANDING: errors.SALES_CREDIT_NOTE_EXCEEDS_OUTSTANDING,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const postSalesCreditNoteRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/sales-credit-notes/{id}/post",
    operationId: "postSalesCreditNote",
    tags: ["sales-credit-note"],
    summary: "Post a draft credit note",
    middleware: [requireAuth, requirePermission("post:sales-credit-note")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), id: z.string().uuid() }),
    },
    responses: {
      200: jsonOk("Post a draft credit note", SalesCreditNoteDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [
        Code.SALES_CREDIT_NOTE_NOT_FOUND,
        Code.SALES_CREDIT_NOTE_INVOICE_NOT_FOUND,
      ]),
      409: jsonError("Conflict", [
        Code.SALES_CREDIT_NOTE_ALREADY_POSTED,
        Code.SALES_CREDIT_NOTE_NOT_EDITABLE,
        Code.SALES_CREDIT_NOTE_POSTING_FAILED,
        Code.SALES_CREDIT_NOTE_INVOICE_NOT_POSTED,
        Code.SALES_CREDIT_NOTE_EXCEEDS_OUTSTANDING,
      ]),
      422: jsonError("Invalid request", [
        Code.SALES_CREDIT_NOTE_AMOUNT_NOT_POSITIVE,
      ]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, id } = c.req.valid("param")

    const result = await service.post(user.id, orgId, id)
    return handleResult({ c, result, successStatus: 200, errorMap, errorTrans, moduleName: "sales-credit-note" })
  })

  return router
}
