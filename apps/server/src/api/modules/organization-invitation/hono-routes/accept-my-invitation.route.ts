import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { organizationInvitationErrorsHttpMap as errors } from "../organization-invitation.errors.js"
import { honoPath, jsonError, jsonOk } from "./_shared.js"
import type { RouteDeps } from "./module-routes.types.js"
import {
  AcceptInvitationResponseSchema,
  AcceptMyInvitationSchema,
  OrganizationInvitationErrorCode as Code,
} from "@avuny/contracts"

const rawErrorMap = {
  ORGANIZATION_INVITATION_NOT_FOUND: errors.ORGANIZATION_INVITATION_NOT_FOUND,
  ORGANIZATION_INVITATION_IDENTITY_MISMATCH: errors.ORGANIZATION_INVITATION_IDENTITY_MISMATCH,
  ORGANIZATION_INVITATION_NOT_PENDING: errors.ORGANIZATION_INVITATION_NOT_PENDING,
  ORGANIZATION_INVITATION_EXPIRED: errors.ORGANIZATION_INVITATION_EXPIRED,
  ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE: errors.ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE,
  ORGANIZATION_INVITATION_ALREADY_MEMBER: errors.ORGANIZATION_INVITATION_ALREADY_MEMBER,
  ORGANIZATION_INVITATION_LIMIT_REACHED: errors.ORGANIZATION_INVITATION_LIMIT_REACHED,
  ORGANIZATION_INVITATION_USERNAME_REQUIRED: errors.ORGANIZATION_INVITATION_USERNAME_REQUIRED,
  ORGANIZATION_INVITATION_USERNAME_TAKEN: errors.ORGANIZATION_INVITATION_USERNAME_TAKEN,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const acceptMyInvitationRoute = ({ service, requireAuth }: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/me/invitations/{invitationId}/accept",
    operationId: "acceptMyInvitation",
    tags: ["organization-invitation"],
    summary: "Accept an invitation from my inbox",
    middleware: [requireAuth] as const,
    request: {
      params: z.object({ invitationId: z.string().uuid() }),
      body: { content: { "application/json": { schema: AcceptMyInvitationSchema } } },
    },
    responses: {
      200: jsonOk("Joined the organization", AcceptInvitationResponseSchema),
      403: jsonError("Identity mismatch", [Code.ORGANIZATION_INVITATION_IDENTITY_MISMATCH]),
      404: jsonError("Invitation not found", [Code.ORGANIZATION_INVITATION_NOT_FOUND]),
      409: jsonError("Cannot accept", [
        Code.ORGANIZATION_INVITATION_NOT_PENDING,
        Code.ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE,
        Code.ORGANIZATION_INVITATION_ALREADY_MEMBER,
        Code.ORGANIZATION_INVITATION_LIMIT_REACHED,
        Code.ORGANIZATION_INVITATION_USERNAME_TAKEN,
      ]),
      410: jsonError("Expired", [Code.ORGANIZATION_INVITATION_EXPIRED]),
      422: jsonError("Username required", [Code.ORGANIZATION_INVITATION_USERNAME_REQUIRED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { invitationId } = c.req.valid("param")
    const body = c.req.valid("json")

    const result = await service.acceptMine(user.id, invitationId, body)
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

export default acceptMyInvitationRoute
