import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { unitErrorsHttpMap as errors } from "../unit.errors.js"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import {
  CreateUnitCollectionSchema,
  UnitCollectionDtoSchema,
  RoleErrorCode,
  UnitErrorCode as Code,
} from "@avuny/contracts"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  UNIT_COLLECTION_TOO_MANY_UNITS: errors.UNIT_COLLECTION_TOO_MANY_UNITS,
  UNIT_DUPLICATE_IN_COLLECTION: errors.UNIT_DUPLICATE_IN_COLLECTION,
  UNIT_FEATURE_NOT_AVAILABLE: errors.UNIT_FEATURE_NOT_AVAILABLE,
  UNIT_INVALID_CONVERSION_FACTOR: errors.UNIT_INVALID_CONVERSION_FACTOR,
  UNIT_NOT_FOUND: errors.UNIT_NOT_FOUND,
  UNIT_TYPE_MISMATCH: errors.UNIT_TYPE_MISMATCH,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const createUnitCollectionRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/unit-collections",
    operationId: "createUnitCollection",
    tags: ["unit"],
    summary: "Create a unit collection: a base unit plus units that convert to it",
    middleware: [requireAuth, requirePermission("create:unit")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      body: { content: { "application/json": { schema: CreateUnitCollectionSchema } } },
    },
    responses: {
      201: jsonOk("Unit collection created", UnitCollectionDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED, Code.UNIT_FEATURE_NOT_AVAILABLE]),
      404: jsonError("Not found", [Code.UNIT_NOT_FOUND]),
      422: jsonError("Invalid request", [Code.UNIT_TYPE_MISMATCH, Code.UNIT_DUPLICATE_IN_COLLECTION, Code.UNIT_COLLECTION_TOO_MANY_UNITS, Code.UNIT_INVALID_CONVERSION_FACTOR]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId } = c.req.valid("param")
    const body = c.req.valid("json")

    const result = await service.createCollection(user.id, orgId, body)
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

export default createUnitCollectionRoute
