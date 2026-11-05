import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import {
  OrganizationUserErrorCode as Code,
  OrganizationUserOffsetListQuerySchema,
  OrganizationUserOffsetListResponseSchema,
} from "@avuny/contracts"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { organizationUserErrorsHttpMap as errors } from "../organization-user.errors.js"
import { honoPath, jsonError, jsonOk } from "./_shared.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  ORGANIZATION_USER_FORBIDDEN: errors.ORGANIZATION_USER_FORBIDDEN,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const organizationUserListRoute = ({ service, requireAuth }: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/members",
    operationId: "listOrganizationUsers",
    tags: ["organization-user"],
    summary: "List members of an organization",
    middleware: [requireAuth] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      query: OrganizationUserOffsetListQuerySchema,
    },
    responses: {
      200: jsonOk("Members retrieved", OrganizationUserOffsetListResponseSchema),
      403: jsonError("Forbidden", [Code.ORGANIZATION_USER_FORBIDDEN]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId } = c.req.valid("param")
    const query = c.req.valid("query")

    const result = await service.list(user.id, orgId, query)
    return handleResult({
      c,
      result,
      successStatus: 200,
      errorMap,
      errorTrans,
      moduleName: "organization-user",
    })
  })

  return router
}

export default organizationUserListRoute
