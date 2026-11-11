import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import {
  CreateUnitSchema,
  UnitDtoSchema,
  UnitErrorCode,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { unitErrorsHttpMap as errors } from "../unit.errors.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  UNIT_NAME_TAKEN: errors.UNIT_NAME_TAKEN,
  UNIT_SYMBOL_TAKEN: errors.UNIT_SYMBOL_TAKEN,
} as const

const errorMap = rawErrorMap as Record<
  UnitErrorCode,
  (typeof rawErrorMap)[keyof typeof rawErrorMap]
>

export const createUnitRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/units",
    operationId: "createUnit",
    tags: ["unit"],
    summary: "Create a custom unit of measure for an organization",
    middleware: [requireAuth, requirePermission("create:unit")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      body: { content: { "application/json": { schema: CreateUnitSchema } } },
    },
    responses: {
      201: jsonOk("Unit created", UnitDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      409: jsonError("Name or symbol collision", [
        UnitErrorCode.UNIT_NAME_TAKEN,
        UnitErrorCode.UNIT_SYMBOL_TAKEN,
      ]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user") as { id: string }
    const { orgId } = c.req.valid("param")
    const body = c.req.valid("json")

    const result = await service.createUnit(user.id, orgId, body)
    return handleResult({
      c,
      result,
      successStatus: 201,
      errorMap,
      errorTrans,
      moduleName: "unit",
    })
  })

  return router
}

export default createUnitRoute

