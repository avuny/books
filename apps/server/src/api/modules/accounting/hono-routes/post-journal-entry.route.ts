import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  AccountingErrorCode as Code,
  JournalEntryDtoSchema,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { accountingErrorsHttpMap as errors } from "../accounting.errors.js"
import { requirePermission as defaultRequirePermission } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  JOURNAL_ENTRY_NOT_FOUND: errors.JOURNAL_ENTRY_NOT_FOUND,
  JOURNAL_ENTRY_ALREADY_POSTED: errors.JOURNAL_ENTRY_ALREADY_POSTED,
  JOURNAL_ENTRY_PERIOD_CLOSED: errors.JOURNAL_ENTRY_PERIOD_CLOSED,
  JOURNAL_ENTRY_UNBALANCED: errors.JOURNAL_ENTRY_UNBALANCED,
  JOURNAL_ENTRY_INVALID_LINE: errors.JOURNAL_ENTRY_INVALID_LINE,
  ACCOUNTING_INVALID_AMOUNT: errors.ACCOUNTING_INVALID_AMOUNT,
  ACCOUNT_INACTIVE: errors.ACCOUNT_INACTIVE,
  ACCOUNT_CANNOT_POST: errors.ACCOUNT_CANNOT_POST,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const postJournalEntryRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/journal-entries/{entryId}/post",
    operationId: "postJournalEntry",
    tags: ["accounting"],
    summary: "Post a draft journal entry to the ledger",
    middleware: [requireAuth, requirePermission("create:accounting")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), entryId: z.string().uuid() }),
    },
    responses: {
      200: jsonOk("Journal entry posted", JournalEntryDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.JOURNAL_ENTRY_NOT_FOUND]),
      409: jsonError("Conflict", [Code.JOURNAL_ENTRY_ALREADY_POSTED, Code.JOURNAL_ENTRY_PERIOD_CLOSED]),
      422: jsonError("Invalid request", [
        Code.JOURNAL_ENTRY_UNBALANCED,
        Code.JOURNAL_ENTRY_INVALID_LINE,
        Code.ACCOUNTING_INVALID_AMOUNT,
        Code.ACCOUNT_INACTIVE,
        Code.ACCOUNT_CANNOT_POST,
      ]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, entryId } = c.req.valid("param")

    const result = await service.postJournalEntry(user.id, orgId, entryId)
    return handleResult({
      c,
      result,
      successStatus: 200,
      errorMap,
      errorTrans,
      moduleName: "accounting",
    })
  })

  return router
}

export default postJournalEntryRoute
