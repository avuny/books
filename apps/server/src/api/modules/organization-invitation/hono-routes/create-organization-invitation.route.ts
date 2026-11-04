import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { organizationInvitationErrorsHttpMap as errors } from "../organization-invitation.errors.js"
import { honoPath, jsonError, jsonOk } from "./_shared.js"
import type { RouteDeps } from "./module-routes.types.js"
import {
  CreateOrganizationInvitationSchema,
  OrganizationInvitationDtoSchema,
  OrganizationInvitationErrorCode as Code,
} from "@avuny/contracts"

// Static data, no instances: safe at module level.
const rawErrorMap = {
  ORGANIZATION_INVITATION_FORBIDDEN: errors.ORGANIZATION_INVITATION_FORBIDDEN,
  ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE: errors.ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE,
  ORGANIZATION_INVITATION_ALREADY_MEMBER: errors.ORGANIZATION_INVITATION_ALREADY_MEMBER,
  ORGANIZATION_INVITATION_LIMIT_REACHED: errors.ORGANIZATION_INVITATION_LIMIT_REACHED,
  ORGANIZATION_INVITATION_ALREADY_PENDING: errors.ORGANIZATION_INVITATION_ALREADY_PENDING,
  ORGANIZATION_INVITATION_ROLE_NOT_FOUND: errors.ORGANIZATION_INVITATION_ROLE_NOT_FOUND,
  ORGANIZATION_INVITATION_TARGET_UNAVAILABLE: errors.ORGANIZATION_INVITATION_TARGET_UNAVAILABLE,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const createOrganizationInvitationRoute = ({ service, requireAuth }: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/invitations",
    operationId: "createOrganizationInvitation",
    tags: ["organization-invitation"],
    summary: "Invite someone to the organization",
    middleware: [requireAuth] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      body: {
        content: { "application/json": { schema: CreateOrganizationInvitationSchema } },
      },
    },
    responses: {
      201: jsonOk("Invitation created", OrganizationInvitationDtoSchema),
      403: jsonError("Forbidden", [Code.ORGANIZATION_INVITATION_FORBIDDEN]),
      404: jsonError("Role not found", [Code.ORGANIZATION_INVITATION_ROLE_NOT_FOUND]),
      409: jsonError("Conflict", [
        Code.ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE,
        Code.ORGANIZATION_INVITATION_ALREADY_MEMBER,
        Code.ORGANIZATION_INVITATION_LIMIT_REACHED,
        Code.ORGANIZATION_INVITATION_ALREADY_PENDING,
      ]),
      422: jsonError("Invitee has no usable contact", [
        Code.ORGANIZATION_INVITATION_TARGET_UNAVAILABLE,
      ]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId } = c.req.valid("param")
    const body = c.req.valid("json")

    const result = await service.create(user.id, orgId, body)
    return handleResult({
      c,
      result,
      successStatus: 201,
      errorMap,
      errorTrans,
      moduleName: "organization-invitation",
    })
  })

  return router
}

export default createOrganizationInvitationRoute
