import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import {
  CreateOrganizationSchema,
  OrganizationDtoSchema,
  OrganizationErrorCode as Code,
} from "@avuny/contracts"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { organizationErrorsHttpMap as errors } from "../organization.errors.js"
import { honoPath, jsonError, jsonOk } from "./_shared.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  ORGANIZATION_FORBIDDEN: errors.ORGANIZATION_FORBIDDEN,
  ORGANIZATION_LIMIT_REACHED: errors.ORGANIZATION_LIMIT_REACHED,
  ORGANIZATION_NAME_TAKEN: errors.ORGANIZATION_NAME_TAKEN,
  ORGANIZATION_CODE_TAKEN: errors.ORGANIZATION_CODE_TAKEN,
  ORGANIZATION_CODE_RESERVED: errors.ORGANIZATION_CODE_RESERVED,
} as const

const createOrganizationErrorMap = rawErrorMap as Record<
  Code,
  (typeof rawErrorMap)[keyof typeof rawErrorMap]
>

export const createOrganizationRoute = ({ service, requireAuth }: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/",
    operationId: "createOrganization",
    tags: ["organization"],
    summary: "Create a new organization",
    middleware: [requireAuth] as const,
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateOrganizationSchema,
          },
        },
      },
    },
    responses: {
      201: jsonOk("Organization created successfully", OrganizationDtoSchema),
      403: jsonError("Forbidden", [Code.ORGANIZATION_FORBIDDEN]),
      409: jsonError("Conflict (limit reached, name taken, or code taken)", [
        Code.ORGANIZATION_LIMIT_REACHED,
        Code.ORGANIZATION_NAME_TAKEN,
        Code.ORGANIZATION_CODE_TAKEN,
      ]),
      422: jsonError("Organization code is reserved", [
        Code.ORGANIZATION_CODE_RESERVED,
      ]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const body = c.req.valid("json")

    const result = await service.create(user.id, body)

    return handleResult({
      c,
      result,
      successStatus: 201,
      errorMap: createOrganizationErrorMap,
      errorTrans,
      moduleName: "organization",
    })
  })

  return router
}

export default createOrganizationRoute
