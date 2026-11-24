import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { partyErrorsHttpMap as errors } from "../party.errors.js"
import { jsonError, jsonOk, honoPath } from "./_shared.js"
import {
  CreatePartySchema,
  PartyDtoSchema,
  PartyErrorCode as Code,
} from "@avuny/contracts/party"
import { RoleErrorCode } from "@avuny/contracts"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  ROLE_PERMISSION_DENIED: errors.ROLE_PERMISSION_DENIED,
  PARTY_EMAIL_ALREADY_EXISTS: errors.PARTY_EMAIL_ALREADY_EXISTS,
} as const

const errorMap = rawErrorMap as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const createPartyRoute = ({ service, requireAuth }: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/parties",
    operationId: "createParty",
    tags: ["party"],
    summary: "Create a new party (customer, vendor, or both)",
    middleware: [requireAuth] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      body: { content: { "application/json": { schema: CreatePartySchema } } },
    },
    responses: {
      201: jsonOk("Party created", PartyDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      409: jsonError("Email conflict", [Code.PARTY_EMAIL_ALREADY_EXISTS]),
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
    return handleResult({ c, result, successStatus: 201, errorMap, errorTrans, moduleName: "party" })
  })

  return router
}

export default createPartyRoute
