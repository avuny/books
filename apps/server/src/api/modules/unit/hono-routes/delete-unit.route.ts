import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import {
  DeleteUnitResponseSchema,
  UnitErrorCode,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { unitErrorsHttpMap as errors } from "../unit.errors.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  UNIT_NOT_FOUND: errors.UNIT_NOT_FOUND,
  UNIT_SYSTEM_IMMUTABLE: errors.UNIT_SYSTEM_IMMUTABLE,
  UNIT_IN_USE: errors.UNIT_IN_USE,
} as const

const errorMap = rawErrorMap as Record<
  UnitErrorCode,
  (typeof rawErrorMap)[keyof typeof rawErrorMap]
>

export const deleteUnitRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "delete",
    path: "/organizations/{orgId}/units/{unitId}",
    operationId: "deleteUnit",
    tags: ["unit"],
    summary: "Delete a custom unit (refused if used in collections or items)",
    middleware: [requireAuth, requirePermission("delete:unit")] as const,
    request: {
      params: z.object({
        orgId: z.string().uuid(),
        unitId: z.string().uuid(),
      }),
    },
    responses: {
      200: jsonOk("Unit deleted", DeleteUnitResponseSchema),
      400: jsonError("System unit immutable", [UnitErrorCode.UNIT_SYSTEM_IMMUTABLE]),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Unit not found", [UnitErrorCode.UNIT_NOT_FOUND]),
      409: jsonError("Unit in use", [UnitErrorCode.UNIT_IN_USE]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user") as { id: string }
    const { orgId, unitId } = c.req.valid("param")

    const result = await service.deleteUnit(user.id, orgId, unitId)
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

export default deleteUnitRoute

