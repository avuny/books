import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  AccountingErrorCode as Code,
  JournalEntryOffsetListQuerySchema,
  JournalEntryOffsetListResponseSchema,
  RoleErrorCode,
} from "@avuny/contracts"
import { requirePermission as defaultRequirePermission } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import type { RouteDeps } from "./module-routes.types.js"

export const listJournalEntriesRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/journal-entries",
    operationId: "listJournalEntries",
    tags: ["accounting"],
    summary: "List journal entries (filter by status, dates, source, account or text)",
    middleware: [requireAuth, requirePermission("read:accounting")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      query: JournalEntryOffsetListQuerySchema,
    },
    responses: {
      200: jsonOk("Journal entries retrieved", JournalEntryOffsetListResponseSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const { orgId } = c.req.valid("param")
    const query = c.req.valid("query")

    const result = await service.listJournalEntries(orgId, query)
    if (!result.success) throw new Error("this read cannot fail")
    return c.json({ success: true, data: result.data }, 200)
  })

  return router
}

export default listJournalEntriesRoute
