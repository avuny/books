import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import {
  OrganizationDtoSchema,
  OrganizationErrorCode as Code,
} from "@avuny/contracts"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { organizationErrorsHttpMap as errors } from "../organization.errors.js"
import { honoPath, jsonError, jsonOk } from "./_shared.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  ORGANIZATION_NOT_FOUND: errors.ORGANIZATION_NOT_FOUND,
  ORGANIZATION_FORBIDDEN: errors.ORGANIZATION_FORBIDDEN,
} as const

const getOrganizationErrorMap = rawErrorMap as Record<
  Code,
  (typeof rawErrorMap)[keyof typeof rawErrorMap]
>

export const getOrganizationRoute = ({ service, requireAuth }: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/{id}",
    operationId: "getOrganization",
    tags: ["organization"],
    summary: "Get organization by ID",
    middleware: [requireAuth] as const,
    request: {
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    responses: {
      200: jsonOk("Organization retrieved successfully", OrganizationDtoSchema),
      403: jsonError("Forbidden", [Code.ORGANIZATION_FORBIDDEN]),
      404: jsonError("Organization not found", [Code.ORGANIZATION_NOT_FOUND]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { id } = c.req.valid("param")

    const result = await service.getById(user.id, id)

    return handleResult({
      c,
      result,
      successStatus: 200,
      errorMap: getOrganizationErrorMap,
      errorTrans,
      moduleName: "organization",
    })
  })

  return router
}

export default getOrganizationRoute
