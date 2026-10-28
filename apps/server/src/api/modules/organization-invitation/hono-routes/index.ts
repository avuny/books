import { createOpenAPIRouter } from "@avuny/hono"
import createOrganizationInvitationRoute from "./create-organization-invitation.route.js"
import organizationInvitationListRoute from "./organization-invitation-list.route.js"
import revokeOrganizationInvitationRoute from "./revoke-organization-invitation.route.js"
import resendOrganizationInvitationRoute from "./resend-organization-invitation.route.js"
import previewOrganizationInvitationRoute from "./preview-organization-invitation.route.js"
import acceptOrganizationInvitationRoute from "./accept-organization-invitation.route.js"
import myInvitationListRoute from "./my-invitation-list.route.js"
import acceptMyInvitationRoute from "./accept-my-invitation.route.js"
import declineMyInvitationRoute from "./decline-my-invitation.route.js"

/** Paths are absolute (e.g. /organizations/{orgId}/invitations), so mount this at "/". */
export const organizationInvitationRoutes = createOpenAPIRouter()

organizationInvitationRoutes.route("/", organizationInvitationListRoute)
organizationInvitationRoutes.route("/", createOrganizationInvitationRoute)
organizationInvitationRoutes.route("/", revokeOrganizationInvitationRoute)
organizationInvitationRoutes.route("/", resendOrganizationInvitationRoute)
organizationInvitationRoutes.route("/", previewOrganizationInvitationRoute)
organizationInvitationRoutes.route("/", acceptOrganizationInvitationRoute)
organizationInvitationRoutes.route("/", myInvitationListRoute)
organizationInvitationRoutes.route("/", acceptMyInvitationRoute)
organizationInvitationRoutes.route("/", declineMyInvitationRoute)
