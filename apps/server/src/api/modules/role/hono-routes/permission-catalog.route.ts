import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter } from "@avuny/hono"
import { PermissionCatalogResponseSchema } from "@avuny/contracts"
import { globalErrorResponses } from "@avuny/utils"
import { roleService } from "../role.service.js"
import { requireAuth } from "../../auth/index.js"
import { honoPath, jsonOk } from "./_shared.js"

const router = createOpenAPIRouter()

export const permissionCatalogRoute = createRoute({
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

router.use(honoPath(permissionCatalogRoute.path), requireAuth)

// Static data that cannot fail with a domain error.
router.openapi(permissionCatalogRoute, async (c) => {
  const result = roleService.getCatalog()
  if (!result.success) throw new Error("getCatalog cannot fail")
  return c.json({ success: true, data: result.data }, 200)
})

export default router
