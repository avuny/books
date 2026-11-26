import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import {
  UpdateUnitSchema,
  UnitDtoSchema,
  UnitErrorCode,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { unitErrorsHttpMap as errors } from "../unit.errors.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  UNIT_NOT_FOUND: errors.UNIT_NOT_FOUND,
  UNIT_SYSTEM_IMMUTABLE: errors.UNIT_SYSTEM_IMMUTABLE,
  UNIT_NAME_TAKEN: errors.UNIT_NAME_TAKEN,
  UNIT_SYMBOL_TAKEN: errors.UNIT_SYMBOL_TAKEN,
} as const

const errorMap = rawErrorMap as Record<
  UnitErrorCode,
  (typeof rawErrorMap)[keyof typeof rawErrorMap]
>

export const updateUnitRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "patch",
    path: "/organizations/{orgId}/units/{unitId}",
    operationId: "updateUnit",
    tags: ["unit"],
    summary: "Update a custom unit (rename, change symbol, or active status)",
    middleware: [requireAuth, requirePermission("update:unit")] as const,
    request: {
      params: z.object({
        orgId: z.string().uuid(),
        unitId: z.string().uuid(),
      }),
      body: { content: { "application/json": { schema: UpdateUnitSchema } } },
    },
    responses: {
      200: jsonOk("Unit updated", UnitDtoSchema),
      400: jsonError("System unit immutable", [UnitErrorCode.UNIT_SYSTEM_IMMUTABLE]),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Unit not found", [UnitErrorCode.UNIT_NOT_FOUND]),
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
    const { orgId, unitId } = c.req.valid("param")
    const body = c.req.valid("json")

    const result = await service.updateUnit(user.id, orgId, unitId, body)
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

export default updateUnitRoute

