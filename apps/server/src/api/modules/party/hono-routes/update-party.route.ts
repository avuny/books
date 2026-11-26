import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { partyErrorsHttpMap as errors } from "../party.errors.js"
import { jsonError, jsonOk, honoPath } from "./_shared.js"
import {
  UpdatePartySchema,
  PartyDtoSchema,
  PartyRoleQuerySchema,
  PartyErrorCode as Code,
} from "@avuny/contracts/party"
import { RoleErrorCode } from "@avuny/contracts"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  ROLE_PERMISSION_DENIED: errors.ROLE_PERMISSION_DENIED,
  PARTY_NOT_FOUND: errors.PARTY_NOT_FOUND,
  PARTY_ROLE_NOT_FOUND: errors.PARTY_ROLE_NOT_FOUND,
  PARTY_CONTACT_NOT_FOUND: errors.PARTY_CONTACT_NOT_FOUND,
  PARTY_ROLE_INACTIVE: errors.PARTY_ROLE_INACTIVE,
  PARTY_EMAIL_ALREADY_EXISTS: errors.PARTY_EMAIL_ALREADY_EXISTS,
  PARTY_SALUTATION_NOT_ALLOWED: errors.PARTY_SALUTATION_NOT_ALLOWED,
} as const

const errorMap = rawErrorMap as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const updatePartyRoute = ({ service, requireAuth }: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "patch",
    path: "/organizations/{orgId}/parties/{partyId}",
    operationId: "updateParty",
    tags: ["party"],
    summary: "Update party shared data and contact collections",
    middleware: [requireAuth] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), partyId: z.string().uuid() }),
      query: PartyRoleQuerySchema,
      body: { content: { "application/json": { schema: UpdatePartySchema } } },
    },
    responses: {
      200: jsonOk("Party updated", PartyDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.PARTY_NOT_FOUND, Code.PARTY_ROLE_NOT_FOUND, Code.PARTY_CONTACT_NOT_FOUND]),
      409: jsonError("Conflict", [Code.PARTY_ROLE_INACTIVE, Code.PARTY_EMAIL_ALREADY_EXISTS]),
      422: jsonError("Unprocessable", [Code.PARTY_SALUTATION_NOT_ALLOWED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, partyId } = c.req.valid("param")
    const { role } = c.req.valid("query")
    const body = c.req.valid("json")
    const result = await service.update(user.id, orgId, partyId, role, body)
    return handleResult({ c, result, successStatus: 200, errorMap, errorTrans, moduleName: "party" })
  })

  return router
}

export default updatePartyRoute
