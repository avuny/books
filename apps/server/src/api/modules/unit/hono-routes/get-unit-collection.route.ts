import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { unitErrorsHttpMap as errors } from "../unit.errors.js"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import {
  UnitCollectionDtoSchema,
  RoleErrorCode,
  UnitErrorCode as Code,
} from "@avuny/contracts"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  UNIT_COLLECTION_NOT_FOUND: errors.UNIT_COLLECTION_NOT_FOUND,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const getUnitCollectionRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/unit-collections/{collectionId}",
    operationId: "getUnitCollection",
    tags: ["unit"],
    summary: "Get a unit collection with its units and conversion factors",
    middleware: [requireAuth, requirePermission("read:unit")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), collectionId: z.string().uuid() }),
    },
    responses: {
      200: jsonOk("Unit collection retrieved", UnitCollectionDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.UNIT_COLLECTION_NOT_FOUND]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const { orgId, collectionId } = c.req.valid("param")

    const result = await service.getCollection(orgId, collectionId)
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

export default getUnitCollectionRoute
