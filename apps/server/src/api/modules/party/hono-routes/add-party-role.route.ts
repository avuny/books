import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { partyErrorsHttpMap as errors } from "../party.errors.js"
import { jsonError, jsonOk, honoPath } from "./_shared.js"
import {
  AddPartyRoleSchema,
  PartyDtoSchema,
  PartyErrorCode as Code,
} from "@avuny/contracts/party"
import { RoleErrorCode } from "@avuny/contracts"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  ROLE_PERMISSION_DENIED: errors.ROLE_PERMISSION_DENIED,
  PARTY_NOT_FOUND: errors.PARTY_NOT_FOUND,
  PARTY_ROLE_ALREADY_ACTIVE: errors.PARTY_ROLE_ALREADY_ACTIVE,
} as const

const errorMap = rawErrorMap as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const addPartyRoleRoute = ({ service, requireAuth }: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/parties/{partyId}/roles",
    operationId: "addPartyRole",
    tags: ["party"],
    summary: "Add a new role to an existing party (insert or reactivate)",
    middleware: [requireAuth] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), partyId: z.string().uuid() }),
      body: { content: { "application/json": { schema: AddPartyRoleSchema } } },
    },
    responses: {
      200: jsonOk("Party role added", PartyDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.PARTY_NOT_FOUND]),
      409: jsonError("Conflict", [Code.PARTY_ROLE_ALREADY_ACTIVE]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, partyId } = c.req.valid("param")
    const body = c.req.valid("json")
    const result = await service.addRole(user.id, orgId, partyId, body.role)
    return handleResult({ c, result, successStatus: 200, errorMap, errorTrans, moduleName: "party" })
  })

  return router
}

export default addPartyRoleRoute
