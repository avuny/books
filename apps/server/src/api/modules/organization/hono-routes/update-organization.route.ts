import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import {
  UpdateOrganizationSchema,
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
  ORGANIZATION_NAME_TAKEN: errors.ORGANIZATION_NAME_TAKEN,
} as const

const updateOrganizationErrorMap = rawErrorMap as Record<
  Code,
  (typeof rawErrorMap)[keyof typeof rawErrorMap]
>

export const updateOrganizationRoute = ({ service, requireAuth }: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "patch",
    path: "/{id}",
    operationId: "updateOrganization",
    tags: ["organization"],
    summary: "Update organization details",
    middleware: [requireAuth] as const,
    request: {
      params: z.object({
        id: z.string().uuid(),
      }),
      body: {
        content: {
          "application/json": {
            schema: UpdateOrganizationSchema,
          },
        },
      },
    },
    responses: {
      200: jsonOk("Organization updated successfully", OrganizationDtoSchema),
      403: jsonError("Forbidden", [Code.ORGANIZATION_FORBIDDEN]),
      404: jsonError("Organization not found", [Code.ORGANIZATION_NOT_FOUND]),
      409: jsonError("Organization name already taken", [
        Code.ORGANIZATION_NAME_TAKEN,
      ]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { id } = c.req.valid("param")
    const body = c.req.valid("json")

    const result = await service.update(user.id, id, body)

    return handleResult({
      c,
      result,
      successStatus: 200,
      errorMap: updateOrganizationErrorMap,
      errorTrans,
      moduleName: "organization",
    })
  })

  return router
}

export default updateOrganizationRoute
