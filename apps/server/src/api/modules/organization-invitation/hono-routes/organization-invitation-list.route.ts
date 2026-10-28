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
  OrganizationInvitationErrorCode as Code,
  OrganizationInvitationOffsetListQuerySchema,
  OrganizationInvitationOffsetListResponseSchema,
} from "@avuny/contracts"

const router = createOpenAPIRouter()

const rawErrorMap = {
  ORGANIZATION_INVITATION_FORBIDDEN: errors.ORGANIZATION_INVITATION_FORBIDDEN,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const organizationInvitationListRoute = createRoute({
  method: "get",
  path: "/organizations/{orgId}/invitations",
  operationId: "listOrganizationInvitations",
  tags: ["organization-invitation"],
  summary: "List invitations of an organization",
  middleware: [requireAuth] as const,
  request: {
    params: z.object({ orgId: z.string().uuid() }),
    query: OrganizationInvitationOffsetListQuerySchema,
  },
  responses: {
    200: jsonOk("Invitations retrieved", OrganizationInvitationOffsetListResponseSchema),
    403: jsonError("Forbidden", [Code.ORGANIZATION_INVITATION_FORBIDDEN]),
    ...globalErrorResponses,
  },
})

router.use(honoPath(organizationInvitationListRoute.path), requireAuth)

router.openapi(organizationInvitationListRoute, async (c) => {
  const errorTrans = trans({ lang: getRequestLocale() })
  const user = c.get("user")
  const { orgId } = c.req.valid("param")
  const query = c.req.valid("query")

  const result = await organizationInvitationService.list(user.id, orgId, query)
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
