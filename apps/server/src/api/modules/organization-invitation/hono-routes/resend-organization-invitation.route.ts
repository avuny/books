import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { organizationInvitationErrorsHttpMap as errors } from "../organization-invitation.errors.js"
import { organizationInvitationService } from "../organization-invitation.service.js"
import { requireAuth } from "../../auth/index.js"
import { honoPath, jsonError, jsonOk } from "./_shared.js"
import {
  OrganizationInvitationDtoSchema,
  OrganizationInvitationErrorCode as Code,
} from "@avuny/contracts"

const router = createOpenAPIRouter()

const rawErrorMap = {
  ORGANIZATION_INVITATION_FORBIDDEN: errors.ORGANIZATION_INVITATION_FORBIDDEN,
  ORGANIZATION_INVITATION_NOT_FOUND: errors.ORGANIZATION_INVITATION_NOT_FOUND,
  ORGANIZATION_INVITATION_NOT_PENDING: errors.ORGANIZATION_INVITATION_NOT_PENDING,
  ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE: errors.ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE,
  ORGANIZATION_INVITATION_RESEND_LIMIT_REACHED: errors.ORGANIZATION_INVITATION_RESEND_LIMIT_REACHED,
  ORGANIZATION_INVITATION_EXPIRED: errors.ORGANIZATION_INVITATION_EXPIRED,
  ORGANIZATION_INVITATION_RESEND_TOO_SOON: errors.ORGANIZATION_INVITATION_RESEND_TOO_SOON,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const resendOrganizationInvitationRoute = createRoute({
  method: "post",
  path: "/organizations/{orgId}/invitations/{invitationId}/resend",
  operationId: "resendOrganizationInvitation",
  tags: ["organization-invitation"],
  summary: "Resend a pending invitation (rotates the link and extends the expiry)",
  middleware: [requireAuth] as const,
  request: {
    params: z.object({ orgId: z.string().uuid(), invitationId: z.string().uuid() }),
  },
  responses: {
    200: jsonOk("Invitation resent", OrganizationInvitationDtoSchema),
    403: jsonError("Forbidden", [Code.ORGANIZATION_INVITATION_FORBIDDEN]),
    404: jsonError("Invitation not found", [Code.ORGANIZATION_INVITATION_NOT_FOUND]),
    409: jsonError("Cannot resend", [
      Code.ORGANIZATION_INVITATION_NOT_PENDING,
      Code.ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE,
      Code.ORGANIZATION_INVITATION_RESEND_LIMIT_REACHED,
    ]),
    410: jsonError("Expired", [Code.ORGANIZATION_INVITATION_EXPIRED]),
    429: jsonError("Too soon", [Code.ORGANIZATION_INVITATION_RESEND_TOO_SOON]),
    ...globalErrorResponses,
  },
})

router.use(honoPath(resendOrganizationInvitationRoute.path), requireAuth)

router.openapi(resendOrganizationInvitationRoute, async (c) => {
  const errorTrans = trans({ lang: getRequestLocale() })
  const user = c.get("user")
  const { orgId, invitationId } = c.req.valid("param")

  const result = await organizationInvitationService.resend(user.id, orgId, invitationId)
  return handleResult({
    c,
    result,
    successStatus: 200,
    errorMap,
    errorTrans,
    moduleName: "organization-invitation",
  })
})

export default router
