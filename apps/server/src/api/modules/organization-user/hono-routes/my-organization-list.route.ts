import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter } from "@avuny/hono"
import { MyOrganizationListResponseSchema } from "@avuny/contracts"
import { globalErrorResponses } from "@avuny/utils"
import { organizationUserService } from "../organization-user.service.js"
import { requireAuth } from "../../auth/index.js"
import { honoPath, jsonOk } from "./_shared.js"

const router = createOpenAPIRouter()

export const myOrganizationListRoute = createRoute({
  method: "get",
  path: "/me/organizations",
  operationId: "listMyOrganizations",
  tags: ["organization-user"],
  summary: "Organizations the current user belongs to (switcher), most recent first",
  middleware: [requireAuth] as const,
  responses: {
    200: jsonOk("Organizations retrieved", MyOrganizationListResponseSchema),
    ...globalErrorResponses,
  },
})

router.use(honoPath(myOrganizationListRoute.path), requireAuth)

// This handler cannot fail with a domain error, so it answers directly.
router.openapi(myOrganizationListRoute, async (c) => {
  const user = c.get("user")
  const result = await organizationUserService.listMine(user.id)
  if (!result.success) throw new Error("listMine cannot fail")
  return c.json({ success: true, data: result.data }, 200)
})

export default router
