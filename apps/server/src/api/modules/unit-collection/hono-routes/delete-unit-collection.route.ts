import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import {
  DeleteUnitCollectionResponseSchema,
  UnitCollectionErrorCode,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { unitCollectionErrorsHttpMap as errors } from "../unit-collection.errors.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  UNIT_COLLECTION_NOT_FOUND: errors.UNIT_COLLECTION_NOT_FOUND,
  UNIT_COLLECTION_IN_USE: errors.UNIT_COLLECTION_IN_USE,
} as const

const errorMap = rawErrorMap as Record<
  UnitCollectionErrorCode,
  (typeof rawErrorMap)[keyof typeof rawErrorMap]
>

export const deleteUnitCollectionRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "delete",
    path: "/organizations/{orgId}/unit-collections/{collectionId}",
    operationId: "deleteUnitCollection",
    tags: ["unit-collection"],
    summary: "Delete a unit collection (refused if any item uses it)",
    middleware: [requireAuth, requirePermission("delete:unit")] as const,
    request: {
      params: z.object({
        orgId: z.string().uuid(),
        collectionId: z.string().uuid(),
      }),
    },
    responses: {
      200: jsonOk("Unit collection deleted", DeleteUnitCollectionResponseSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Collection not found", [
        UnitCollectionErrorCode.UNIT_COLLECTION_NOT_FOUND,
      ]),
      409: jsonError("Collection is in use", [
        UnitCollectionErrorCode.UNIT_COLLECTION_IN_USE,
      ]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user") as { id: string }
    const { orgId, collectionId } = c.req.valid("param")

    const result = await service.deleteCollection(user.id, orgId, collectionId)
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

export default deleteUnitCollectionRoute

