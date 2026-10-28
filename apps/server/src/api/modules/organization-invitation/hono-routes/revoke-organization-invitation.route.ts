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
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const revokeOrganizationInvitationRoute = createRoute({
  method: "post",
  path: "/organizations/{orgId}/invitations/{invitationId}/revoke",
  operationId: "revokeOrganizationInvitation",
  tags: ["organization-invitation"],
  summary: "Revoke a pending invitation",
  middleware: [requireAuth] as const,
  request: {
    params: z.object({ orgId: z.string().uuid(), invitationId: z.string().uuid() }),
  },
  responses: {
    200: jsonOk("Invitation revoked", OrganizationInvitationDtoSchema),
    403: jsonError("Forbidden", [Code.ORGANIZATION_INVITATION_FORBIDDEN]),
    404: jsonError("Invitation not found", [Code.ORGANIZATION_INVITATION_NOT_FOUND]),
    409: jsonError("Not pending", [Code.ORGANIZATION_INVITATION_NOT_PENDING]),
    ...globalErrorResponses,
  },
})

router.use(honoPath(revokeOrganizationInvitationRoute.path), requireAuth)

router.openapi(revokeOrganizationInvitationRoute, async (c) => {
  const errorTrans = trans({ lang: getRequestLocale() })
  const user = c.get("user")
  const { orgId, invitationId } = c.req.valid("param")

  const result = await organizationInvitationService.revoke(user.id, orgId, invitationId)
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
