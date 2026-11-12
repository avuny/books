import { describe, expect, it, vi } from "vitest"
import type { MiddlewareHandler } from "hono"
import { createOpenAPIRouter } from "@avuny/hono"
import { fail, ok } from "@avuny/utils"
import { ItemCategoryErrorCode } from "@avuny/contracts"
import { listItemCategoriesRoute } from "../hono-routes/list-item-categories.route.js"
import { itemCategoryTreeRoute } from "../hono-routes/item-category-tree.route.js"
import { createItemCategoryRoute } from "../hono-routes/create-item-category.route.js"
import { deleteItemCategoryRoute } from "../hono-routes/delete-item-category.route.js"

describe("item category routes", () => {
  const orgId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02"
  const categoryId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03"
  const iso = new Date().toISOString()

  const requireAuth: MiddlewareHandler = async (c, next) => {
    c.set("user", { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01" })
    await next()
  }
  const allow = () => (async (_c: any, next: any) => next()) as MiddlewareHandler
  const mount = (route: ReturnType<typeof createOpenAPIRouter>) => {
    const app = createOpenAPIRouter()
    app.route("/", route)
    return app
  }
  const dto = {
    id: categoryId, orgId, parentId: null, name: "Cement", description: null, isActive: true,
    childCount: 0, itemCount: 0, createdAt: iso, updatedAt: iso,
  }

  it("lists with boolean query strings parsed", async () => {
    const service: any = {
      list: vi.fn().mockResolvedValue(ok({ data: { items: [dto], page: 1, pageSize: 20, total: 1 }, msg: "ok" })),
    }
    const app = mount(listItemCategoriesRoute({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(`/organizations/${orgId}/item-categories?isActive=true&parentId=root`)
    expect(res.status).toBe(200)
    expect(service.list).toHaveBeenCalledWith(
      orgId,
      { page: 1, pageSize: 20, isActive: true, parentId: "root" },
      "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01"
    )
  })

  it("serves the tree at /tree", async () => {
    const service: any = {
      tree: vi.fn().mockResolvedValue(ok({ data: { nodes: [{ id: categoryId, parentId: null, name: "Cement", isActive: true }] }, msg: "ok" })),
    }
    const app = mount(itemCategoryTreeRoute({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(`/organizations/${orgId}/item-categories/tree`)
    expect(res.status).toBe(200)
  })

  it("creates a category (201)", async () => {
    const service: any = { create: vi.fn().mockResolvedValue(ok({ data: dto, msg: "created" })) }
    const app = mount(createItemCategoryRoute({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(`/organizations/${orgId}/item-categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Cement" }),
    })
    expect(res.status).toBe(201)
  })

  it("maps ITEM_CATEGORY_IN_USE to 409", async () => {
    const service: any = {
      remove: vi.fn().mockResolvedValue(fail({ error: ItemCategoryErrorCode.ITEM_CATEGORY_IN_USE, msg: "used" })),
    }
    const app = mount(deleteItemCategoryRoute({ service, requireAuth, requirePermission: allow }))
    const res = await app.request(`/organizations/${orgId}/item-categories/${categoryId}`, { method: "DELETE" })
    expect(res.status).toBe(409)
  })
})
