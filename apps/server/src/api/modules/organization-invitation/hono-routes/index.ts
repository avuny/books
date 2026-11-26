import { createOpenAPIRouter } from "@avuny/hono"
import { requireAuth } from "../../auth/index.js"
import { organizationInvitationService } from "../deps.js"
import type { RouteDeps } from "./module-routes.types.js"
import { createOrganizationInvitationRoute } from "./create-organization-invitation.route.js"
import { organizationInvitationListRoute } from "./organization-invitation-list.route.js"
import { revokeOrganizationInvitationRoute } from "./revoke-organization-invitation.route.js"
import { resendOrganizationInvitationRoute } from "./resend-organization-invitation.route.js"
import { previewOrganizationInvitationRoute } from "./preview-organization-invitation.route.js"
import { acceptOrganizationInvitationRoute } from "./accept-organization-invitation.route.js"
import { myInvitationListRoute } from "./my-invitation-list.route.js"
import { acceptMyInvitationRoute } from "./accept-my-invitation.route.js"
import { declineMyInvitationRoute } from "./decline-my-invitation.route.js"

export const createOrganizationInvitationRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()

  router.route("/", organizationInvitationListRoute(deps))
  router.route("/", createOrganizationInvitationRoute(deps))
  router.route("/", revokeOrganizationInvitationRoute(deps))
  router.route("/", resendOrganizationInvitationRoute(deps))
  router.route("/", previewOrganizationInvitationRoute(deps))
  router.route("/", acceptOrganizationInvitationRoute(deps))
  router.route("/", myInvitationListRoute(deps))
  router.route("/", acceptMyInvitationRoute(deps))
  router.route("/", declineMyInvitationRoute(deps))

  return router
}

export const organizationInvitationRoutes = createOrganizationInvitationRoutes({
  service: organizationInvitationService,
  requireAuth,
})

export default organizationInvitationRoutes
