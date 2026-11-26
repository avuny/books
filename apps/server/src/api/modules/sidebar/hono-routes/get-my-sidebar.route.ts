import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter, getRequestLocale } from "@avuny/hono"
import { SidebarDtoSchema, SidebarOrgParamsSchema } from "@avuny/contracts"
import { createResponseSchema, globalErrorResponses } from "@avuny/utils"
import { sidebarService } from "../sidebar.service.js"
import { requireAuth } from "../../auth/index.js"

const router = createOpenAPIRouter()

export const getMySidebarRoute = createRoute({
  method: "get",
  path: "/{orgId}/sidebar",
  operationId: "getMySidebar",
  tags: ["sidebar"],
  summary: "Get the sidebar visible to the current user in an organization",
  middleware: [requireAuth] as const,
  request: {
    params: SidebarOrgParamsSchema,
  },
  responses: {
    200: {
      description: "Sidebar retrieved successfully",
      content: {
        "application/json": {
          schema: createResponseSchema(SidebarDtoSchema),
        },
      },
    },
    ...globalErrorResponses,
  },
})

router.use("/:orgId/sidebar", requireAuth)

router.openapi(getMySidebarRoute, async (c) => {
  const lang = getRequestLocale()
  const user = c.get("user")
  const { orgId } = c.req.valid("param")

  const result = await sidebarService.getForUser({ userId: user.id, orgId, lang })

  // This service cannot fail with a domain error (Result<SidebarDto, never>).
  if (!result.success) throw new Error("getForUser cannot fail")

  // The payload depends on the caller's permissions: never let a shared cache store it.
  c.header("Cache-Control", "private, no-store")

  return c.json({ success: true as const, data: result.data }, 200)
})

export default router
