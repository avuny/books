import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { organizationInvitationErrorsHttpMap as errors } from "../organization-invitation.errors.js"
import { honoPath, jsonError, jsonOk } from "./_shared.js"
import type { RouteDeps } from "./module-routes.types.js"
import {
  OrganizationInvitationDtoSchema,
  OrganizationInvitationErrorCode as Code,
} from "@avuny/contracts"

const rawErrorMap = {
  ORGANIZATION_INVITATION_NOT_FOUND: errors.ORGANIZATION_INVITATION_NOT_FOUND,
  ORGANIZATION_INVITATION_NOT_PENDING: errors.ORGANIZATION_INVITATION_NOT_PENDING,
  ORGANIZATION_INVITATION_EXPIRED: errors.ORGANIZATION_INVITATION_EXPIRED,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const declineMyInvitationRoute = ({ service, requireAuth }: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/me/invitations/{invitationId}/decline",
    operationId: "declineMyInvitation",
    tags: ["organization-invitation"],
    summary: "Decline an invitation from my inbox",
    middleware: [requireAuth] as const,
    request: { params: z.object({ invitationId: z.string().uuid() }) },
    responses: {
      200: jsonOk("Invitation declined", OrganizationInvitationDtoSchema),
      404: jsonError("Invitation not found", [Code.ORGANIZATION_INVITATION_NOT_FOUND]),
      409: jsonError("Not pending", [Code.ORGANIZATION_INVITATION_NOT_PENDING]),
      410: jsonError("Expired", [Code.ORGANIZATION_INVITATION_EXPIRED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { invitationId } = c.req.valid("param")

    const result = await service.decline(user.id, invitationId)
    return handleResult({
      c,
      result,
      successStatus: 200,
      errorMap,
      errorTrans,
      moduleName: "organization-invitation",
    })
  })

  return router
}

export default declineMyInvitationRoute
