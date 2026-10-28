import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter } from "@avuny/hono"
import { MyInvitationListResponseSchema } from "@avuny/contracts"
import { globalErrorResponses } from "@avuny/utils"
import { organizationInvitationService } from "../organization-invitation.service.js"
import { requireAuth } from "../../auth/index.js"
import { honoPath, jsonOk } from "./_shared.js"

const router = createOpenAPIRouter()

export const myInvitationListRoute = createRoute({
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

router.use(honoPath(myInvitationListRoute.path), requireAuth)

// This handler cannot fail with a domain error, so it answers directly.
router.openapi(myInvitationListRoute, async (c) => {
  const user = c.get("user")
  const result = await organizationInvitationService.listMine(user.id)
  if (!result.success) throw new Error("listMine cannot fail")
  return c.json({ success: true, data: result.data }, 200)
})

export default router
