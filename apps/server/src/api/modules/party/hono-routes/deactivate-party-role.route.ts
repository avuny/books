import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { partyErrorsHttpMap as errors } from "../party.errors.js"
import { jsonError, jsonOk, honoPath } from "./_shared.js"
import {
  PartyDtoSchema,
  PartyErrorCode as Code,
} from "@avuny/contracts/party"
import { RoleErrorCode } from "@avuny/contracts"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  ROLE_PERMISSION_DENIED: errors.ROLE_PERMISSION_DENIED,
  PARTY_NOT_FOUND: errors.PARTY_NOT_FOUND,
  PARTY_ROLE_NOT_FOUND: errors.PARTY_ROLE_NOT_FOUND,
  PARTY_ROLE_INACTIVE: errors.PARTY_ROLE_INACTIVE,
} as const

const errorMap = rawErrorMap as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const deactivatePartyRoleRoute = ({ service, requireAuth }: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "delete",
    path: "/organizations/{orgId}/parties/{partyId}/roles/{role}",
    operationId: "deactivatePartyRole",
    tags: ["party"],
    summary: "Deactivate a party role (the party and other roles are unaffected)",
    middleware: [requireAuth] as const,
    request: {
      params: z.object({
        orgId: z.string().uuid(),
        partyId: z.string().uuid(),
        role: z.enum(["CUSTOMER", "VENDOR"]),
      }),
    },
    responses: {
      200: jsonOk("Party role deactivated", PartyDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.PARTY_NOT_FOUND, Code.PARTY_ROLE_NOT_FOUND]),
      409: jsonError("Conflict", [Code.PARTY_ROLE_INACTIVE]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, partyId, role } = c.req.valid("param")
    const result = await service.delete(user.id, orgId, partyId, role)
    return handleResult({ c, result, successStatus: 200, errorMap, errorTrans, moduleName: "party" })
  })

  return router
}

export default deactivatePartyRoleRoute
