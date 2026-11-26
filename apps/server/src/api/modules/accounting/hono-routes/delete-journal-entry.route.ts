import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  AccountingErrorCode as Code,
  DeleteJournalEntryResponseSchema,
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
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const deleteJournalEntryRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "delete",
    path: "/organizations/{orgId}/journal-entries/{entryId}",
    operationId: "deleteJournalEntry",
    tags: ["accounting"],
    summary: "Delete a draft journal entry",
    middleware: [requireAuth, requirePermission("delete:accounting")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), entryId: z.string().uuid() }),
    },
    responses: {
      200: jsonOk("Journal entry deleted", DeleteJournalEntryResponseSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.JOURNAL_ENTRY_NOT_FOUND]),
      409: jsonError("Conflict", [Code.JOURNAL_ENTRY_ALREADY_POSTED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, entryId } = c.req.valid("param")

    const result = await service.deleteJournalEntry(user.id, orgId, entryId)
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

export default deleteJournalEntryRoute
