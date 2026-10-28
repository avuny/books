import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import {
  InvitationPreviewDtoSchema,
  OrganizationInvitationErrorCode as Code,
  PreviewInvitationSchema,
} from "@avuny/contracts"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { organizationInvitationErrorsHttpMap as errors } from "../organization-invitation.errors.js"
import { organizationInvitationService } from "../organization-invitation.service.js"
import { jsonError, jsonOk } from "./_shared.js"

const router = createOpenAPIRouter()

const rawErrorMap = {
  ORGANIZATION_INVITATION_NOT_FOUND: errors.ORGANIZATION_INVITATION_NOT_FOUND,
  ORGANIZATION_INVITATION_NOT_PENDING: errors.ORGANIZATION_INVITATION_NOT_PENDING,
  ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE: errors.ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE,
  ORGANIZATION_INVITATION_EXPIRED: errors.ORGANIZATION_INVITATION_EXPIRED,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

/**
 * PUBLIC (no auth): the sign-up page needs it before the invitee has an account.
 * POST with the token in the body so it never lands in URLs or access logs.
 * Put a strict rate limit in front of this route.
 */
export const previewOrganizationInvitationRoute = createRoute({
  method: "post",
  path: "/invitations/preview",
  operationId: "previewOrganizationInvitation",
  tags: ["organization-invitation"],
  summary: "Preview an invitation from its link token",
  request: {
    body: { content: { "application/json": { schema: PreviewInvitationSchema } } },
  },
  responses: {
    200: jsonOk("Invitation preview", InvitationPreviewDtoSchema),
    404: jsonError("Invitation not found", [Code.ORGANIZATION_INVITATION_NOT_FOUND]),
    409: jsonError("Not usable", [
      Code.ORGANIZATION_INVITATION_NOT_PENDING,
      Code.ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE,
    ]),
    410: jsonError("Expired", [Code.ORGANIZATION_INVITATION_EXPIRED]),
    ...globalErrorResponses,
  },
})

router.openapi(previewOrganizationInvitationRoute, async (c) => {
  const errorTrans = trans({ lang: getRequestLocale() })
  const { token } = c.req.valid("json")

  const result = await organizationInvitationService.preview(token)
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
