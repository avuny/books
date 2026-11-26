import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  AccountingErrorCode as Code,
  JournalEntryDtoSchema,
  ReverseJournalEntrySchema,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { accountingErrorsHttpMap as errors } from "../accounting.errors.js"
import { requirePermission as defaultRequirePermission } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  JOURNAL_ENTRY_NOT_FOUND: errors.JOURNAL_ENTRY_NOT_FOUND,
  JOURNAL_ENTRY_NOT_POSTED: errors.JOURNAL_ENTRY_NOT_POSTED,
  JOURNAL_ENTRY_ALREADY_REVERSED: errors.JOURNAL_ENTRY_ALREADY_REVERSED,
  JOURNAL_ENTRY_CANNOT_REVERSE_REVERSAL: errors.JOURNAL_ENTRY_CANNOT_REVERSE_REVERSAL,
  JOURNAL_ENTRY_PERIOD_CLOSED: errors.JOURNAL_ENTRY_PERIOD_CLOSED,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const reverseJournalEntryRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/journal-entries/{entryId}/reverse",
    operationId: "reverseJournalEntry",
    tags: ["accounting"],
    summary: "Reverse a posted journal entry with an equal and opposite entry",
    middleware: [requireAuth, requirePermission("update:accounting")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), entryId: z.string().uuid() }),
      body: { content: { "application/json": { schema: ReverseJournalEntrySchema } } },
    },
    responses: {
      201: jsonOk("Reversal entry created", JournalEntryDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.JOURNAL_ENTRY_NOT_FOUND]),
      409: jsonError("Conflict", [
        Code.JOURNAL_ENTRY_NOT_POSTED,
        Code.JOURNAL_ENTRY_ALREADY_REVERSED,
        Code.JOURNAL_ENTRY_CANNOT_REVERSE_REVERSAL,
        Code.JOURNAL_ENTRY_PERIOD_CLOSED,
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

    const result = await service.reverseJournalEntry(user.id, orgId, entryId, body)
    return handleResult({
      c,
      result,
      successStatus: 201,
      errorMap,
      errorTrans,
      moduleName: "accounting",
    })
  })

  return router
}

export default reverseJournalEntryRoute
