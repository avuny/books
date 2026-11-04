import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter } from "@avuny/hono"
import { MyInvitationListResponseSchema } from "@avuny/contracts"
import { globalErrorResponses } from "@avuny/utils"
import { honoPath, jsonOk } from "./_shared.js"
import type { RouteDeps } from "./module-routes.types.js"

export const myInvitationListRoute = ({ service, requireAuth }: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/me/invitations",
    operationId: "listMyInvitations",
    tags: ["organization-invitation"],
    summary: "Open invitations addressed to the current user",
    middleware: [requireAuth] as const,
    responses: {
      200: jsonOk("Invitations retrieved", MyInvitationListResponseSchema),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  // This handler cannot fail with a domain error, so it answers directly.
  router.openapi(route, async (c) => {
    const user = c.get("user")
    const result = await service.listMine(user.id)
    if (!result.success) throw new Error("listMine cannot fail")
    return c.json({ success: true, data: result.data }, 200)
  })

  return router
}

export default myInvitationListRoute
