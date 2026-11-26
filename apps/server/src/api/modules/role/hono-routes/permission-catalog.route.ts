import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter } from "@avuny/hono"
import { PermissionCatalogResponseSchema } from "@avuny/contracts"
import { globalErrorResponses } from "@avuny/utils"
import { honoPath, jsonOk } from "./_shared.js"
import type { RouteDeps } from "./module-routes.types.js"

export const permissionCatalogRoute = ({ service, requireAuth }: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/permissions/catalog",
    operationId: "getPermissionCatalog",
    tags: ["role"],
    summary: "Every permission a role can be granted (resources and their actions)",
    middleware: [requireAuth] as const,
    responses: {
      200: jsonOk("Permission catalog", PermissionCatalogResponseSchema),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  // Static data that cannot fail with a domain error.
  router.openapi(route, async (c) => {
    const result = service.getCatalog()
    if (!result.success) throw new Error("getCatalog cannot fail")
    return c.json({ success: true, data: result.data }, 200)
  })

  return router
}

export default permissionCatalogRoute
