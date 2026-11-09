import { createOpenAPIRouter } from "@avuny/hono"
import { requireAuth } from "../../auth/index.js"
import { itemCategoryService } from "../deps.js"
import type { RouteDeps } from "./module-routes.types.js"
import { listItemCategoriesRoute } from "./list-item-categories.route.js"
import { itemCategoryTreeRoute } from "./item-category-tree.route.js"
import { itemCategoryOptionsRoute } from "./item-category-options.route.js"
import { getItemCategoryRoute } from "./get-item-category.route.js"
import { createItemCategoryRoute } from "./create-item-category.route.js"
import { updateItemCategoryRoute } from "./update-item-category.route.js"
import { deleteItemCategoryRoute } from "./delete-item-category.route.js"

export const createItemCategoryRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()

  router.route("/", listItemCategoriesRoute(deps))
  router.route("/", itemCategoryTreeRoute(deps))
  router.route("/", itemCategoryOptionsRoute(deps))
  router.route("/", getItemCategoryRoute(deps))
  router.route("/", createItemCategoryRoute(deps))
  router.route("/", updateItemCategoryRoute(deps))
  router.route("/", deleteItemCategoryRoute(deps))

  return router
}

export const itemCategoryRoutes = createItemCategoryRoutes({
  service: itemCategoryService,
  requireAuth,
})

export default itemCategoryRoutes
