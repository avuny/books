import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  AccountingErrorCode as Code,
  JournalEntryDtoSchema,
  RoleErrorCode,
  UpdateJournalEntrySchema,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { accountingErrorsHttpMap as errors } from "../accounting.errors.js"
import { requirePermission as defaultRequirePermission } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  JOURNAL_ENTRY_NOT_FOUND: errors.JOURNAL_ENTRY_NOT_FOUND,
  JOURNAL_ENTRY_ALREADY_POSTED: errors.JOURNAL_ENTRY_ALREADY_POSTED,
  JOURNAL_ENTRY_UNBALANCED: errors.JOURNAL_ENTRY_UNBALANCED,
  JOURNAL_ENTRY_INVALID_LINE: errors.JOURNAL_ENTRY_INVALID_LINE,
  ACCOUNTING_INVALID_AMOUNT: errors.ACCOUNTING_INVALID_AMOUNT,
  ACCOUNT_INACTIVE: errors.ACCOUNT_INACTIVE,
  ACCOUNT_CANNOT_POST: errors.ACCOUNT_CANNOT_POST,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const updateJournalEntryRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "patch",
    path: "/organizations/{orgId}/journal-entries/{entryId}",
    operationId: "updateJournalEntry",
    tags: ["accounting"],
    summary: "Change a draft journal entry (a posted entry is immutable: reverse it instead)",
    middleware: [requireAuth, requirePermission("update:accounting")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), entryId: z.string().uuid() }),
      body: { content: { "application/json": { schema: UpdateJournalEntrySchema } } },
    },
    responses: {
      200: jsonOk("Journal entry updated", JournalEntryDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.JOURNAL_ENTRY_NOT_FOUND]),
      409: jsonError("Conflict", [Code.JOURNAL_ENTRY_ALREADY_POSTED]),
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
    const body = c.req.valid("json")

    const result = await service.updateJournalEntry(user.id, orgId, entryId, body)
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

export default updateJournalEntryRoute
