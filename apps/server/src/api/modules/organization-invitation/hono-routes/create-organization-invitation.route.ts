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
  CreateOrganizationInvitationSchema,
  OrganizationInvitationDtoSchema,
  OrganizationInvitationErrorCode as Code,
} from "@avuny/contracts"

const router = createOpenAPIRouter()

const rawErrorMap = {
  ORGANIZATION_INVITATION_FORBIDDEN: errors.ORGANIZATION_INVITATION_FORBIDDEN,
  ORGANIZATION_INVITATION_CHANNEL_NOT_ALLOWED: errors.ORGANIZATION_INVITATION_CHANNEL_NOT_ALLOWED,
  ORGANIZATION_INVITATION_TARGET_UNAVAILABLE: errors.ORGANIZATION_INVITATION_TARGET_UNAVAILABLE,
  ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE: errors.ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE,
  ORGANIZATION_INVITATION_ALREADY_MEMBER: errors.ORGANIZATION_INVITATION_ALREADY_MEMBER,
  ORGANIZATION_INVITATION_MEMBER_TYPE_CONFLICT: errors.ORGANIZATION_INVITATION_MEMBER_TYPE_CONFLICT,
  ORGANIZATION_INVITATION_USERNAME_TAKEN: errors.ORGANIZATION_INVITATION_USERNAME_TAKEN,
  ORGANIZATION_INVITATION_LIMIT_REACHED: errors.ORGANIZATION_INVITATION_LIMIT_REACHED,
  ORGANIZATION_INVITATION_ALREADY_PENDING: errors.ORGANIZATION_INVITATION_ALREADY_PENDING,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const createOrganizationInvitationRoute = createRoute({
  method: "post",
  path: "/organizations/{orgId}/invitations",
  operationId: "createOrganizationInvitation",
  tags: ["organization-invitation"],
  summary: "Invite someone to the organization as a managed or portal user",
  middleware: [requireAuth] as const,
  request: {
    params: z.object({ orgId: z.string().uuid() }),
    body: {
      content: { "application/json": { schema: CreateOrganizationInvitationSchema } },
    },
  },
  responses: {
    201: jsonOk("Invitation created", OrganizationInvitationDtoSchema),
    403: jsonError("Forbidden", [
      Code.ORGANIZATION_INVITATION_FORBIDDEN,
      Code.ORGANIZATION_INVITATION_CHANNEL_NOT_ALLOWED,
    ]),
    409: jsonError("Conflict", [
      Code.ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE,
      Code.ORGANIZATION_INVITATION_ALREADY_MEMBER,
      Code.ORGANIZATION_INVITATION_MEMBER_TYPE_CONFLICT,
      Code.ORGANIZATION_INVITATION_USERNAME_TAKEN,
      Code.ORGANIZATION_INVITATION_LIMIT_REACHED,
      Code.ORGANIZATION_INVITATION_ALREADY_PENDING,
    ]),
    422: jsonError("Invitee has no usable contact", [
      Code.ORGANIZATION_INVITATION_TARGET_UNAVAILABLE,
    ]),
    ...globalErrorResponses,
  },
})

router.use(honoPath(createOrganizationInvitationRoute.path), requireAuth)

router.openapi(createOrganizationInvitationRoute, async (c) => {
  const errorTrans = trans({ lang: getRequestLocale() })
  const user = c.get("user")
  const { orgId } = c.req.valid("param")
  const body = c.req.valid("json")

  const result = await organizationInvitationService.create(user.id, orgId, body)
  return handleResult({
    c,
    result,
    successStatus: 201,
    errorMap,
    errorTrans,
    moduleName: "organization-invitation",
  })
})

export default router
