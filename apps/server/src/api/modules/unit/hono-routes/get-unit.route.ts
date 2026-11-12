import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import {
  UnitDtoSchema,
  UnitErrorCode,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { unitErrorsHttpMap as errors } from "../unit.errors.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  UNIT_NOT_FOUND: errors.UNIT_NOT_FOUND,
} as const

const errorMap = rawErrorMap as Record<
  UnitErrorCode,
  (typeof rawErrorMap)[keyof typeof rawErrorMap]
>

export const getUnitRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/units/{unitId}",
    operationId: "getUnit",
    tags: ["unit"],
    summary: "Get a unit of measure by ID",
    middleware: [requireAuth, requirePermission("read:unit")] as const,
    request: {
      params: z.object({
        orgId: z.string().uuid(),
        unitId: z.string().uuid(),
      }),
    },
    responses: {
      200: jsonOk("Unit retrieved", UnitDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED, UnitErrorCode.UNIT_FORBIDDEN]),
      404: jsonError("Unit not found", [UnitErrorCode.UNIT_NOT_FOUND]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user") as { id: string } | undefined
    const { orgId, unitId } = c.req.valid("param")

    const result = await service.getUnit(orgId, unitId, user?.id)
    return handleResult({
      c,
      result,
      successStatus: 200,
      errorMap,
      errorTrans,
      moduleName: "unit",
    })
  })

  return router
}

export default getUnitRoute

