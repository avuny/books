import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import {
  UpdateUnitCollectionSchema,
  UnitCollectionDtoSchema,
  UnitCollectionErrorCode,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { unitCollectionErrorsHttpMap as errors } from "../unit-collection.errors.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  UNIT_COLLECTION_NOT_FOUND: errors.UNIT_COLLECTION_NOT_FOUND,
  UNIT_NOT_FOUND: errors.UNIT_NOT_FOUND,
  UNIT_FEATURE_NOT_AVAILABLE: errors.UNIT_FEATURE_NOT_AVAILABLE,
  UNIT_TYPE_MISMATCH: errors.UNIT_TYPE_MISMATCH,
  UNIT_DUPLICATE_IN_COLLECTION: errors.UNIT_DUPLICATE_IN_COLLECTION,
  UNIT_COLLECTION_TOO_MANY_UNITS: errors.UNIT_COLLECTION_TOO_MANY_UNITS,
  UNIT_INVALID_CONVERSION_FACTOR: errors.UNIT_INVALID_CONVERSION_FACTOR,
} as const

const errorMap = rawErrorMap as Record<
  UnitCollectionErrorCode,
  (typeof rawErrorMap)[keyof typeof rawErrorMap]
>

export const updateUnitCollectionRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "patch",
    path: "/organizations/{orgId}/unit-collections/{collectionId}",
    operationId: "updateUnitCollection",
    tags: ["unit-collection"],
    summary: "Update a unit collection (rename and/or replace extra units)",
    middleware: [requireAuth, requirePermission("update:unit")] as const,
    request: {
      params: z.object({
        orgId: z.string().uuid(),
        collectionId: z.string().uuid(),
      }),
      body: { content: { "application/json": { schema: UpdateUnitCollectionSchema } } },
    },
    responses: {
      200: jsonOk("Unit collection updated", UnitCollectionDtoSchema),
      403: jsonError("Forbidden", [
        RoleErrorCode.ROLE_PERMISSION_DENIED,
        UnitCollectionErrorCode.UNIT_FEATURE_NOT_AVAILABLE,
      ]),
      404: jsonError("Collection or unit not found", [
        UnitCollectionErrorCode.UNIT_COLLECTION_NOT_FOUND,
        UnitCollectionErrorCode.UNIT_NOT_FOUND,
      ]),
      422: jsonError("Invalid collection definition", [
        UnitCollectionErrorCode.UNIT_TYPE_MISMATCH,
        UnitCollectionErrorCode.UNIT_DUPLICATE_IN_COLLECTION,
        UnitCollectionErrorCode.UNIT_COLLECTION_TOO_MANY_UNITS,
        UnitCollectionErrorCode.UNIT_INVALID_CONVERSION_FACTOR,
      ]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user") as { id: string }
    const { orgId, collectionId } = c.req.valid("param")
    const body = c.req.valid("json")

    const result = await service.updateCollection(user.id, orgId, collectionId, body)
    return handleResult({
      c,
      result,
      successStatus: 200,
      errorMap,
      errorTrans,
      moduleName: "unit-collection",
    })
  })

  return router
}

export default updateUnitCollectionRoute

