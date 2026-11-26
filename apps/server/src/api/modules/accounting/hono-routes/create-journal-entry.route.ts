import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  AccountingErrorCode as Code,
  CreateJournalEntrySchema,
  JournalEntryDtoSchema,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { accountingErrorsHttpMap as errors } from "../accounting.errors.js"
import { requirePermission as defaultRequirePermission } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  JOURNAL_ENTRY_UNBALANCED: errors.JOURNAL_ENTRY_UNBALANCED,
  JOURNAL_ENTRY_INVALID_LINE: errors.JOURNAL_ENTRY_INVALID_LINE,
  ACCOUNTING_INVALID_AMOUNT: errors.ACCOUNTING_INVALID_AMOUNT,
  ACCOUNT_INACTIVE: errors.ACCOUNT_INACTIVE,
  ACCOUNT_CANNOT_POST: errors.ACCOUNT_CANNOT_POST,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const createJournalEntryRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/journal-entries",
    operationId: "createJournalEntry",
    tags: ["accounting"],
    summary: "Create a draft manual journal entry",
    middleware: [requireAuth, requirePermission("create:accounting")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      body: { content: { "application/json": { schema: CreateJournalEntrySchema } } },
    },
    responses: {
      201: jsonOk("Journal entry created", JournalEntryDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
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
    const { orgId } = c.req.valid("param")
    const body = c.req.valid("json")

    const result = await service.createJournalEntry(user.id, orgId, body)
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

export default createJournalEntryRoute
