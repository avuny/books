import { describe, expect, it, vi } from "vitest"
import type { MiddlewareHandler } from "hono"
import { createOpenAPIRouter } from "@avuny/hono"
import { ok, fail } from "@avuny/utils"
import { RoleErrorCode } from "@avuny/contracts"
import { permissionCatalogRoute } from "../hono-routes/permission-catalog.route.js"
import { roleListRoute } from "../hono-routes/role-list.route.js"
import { roleOptionsRoute } from "../hono-routes/role-options.route.js"
import { createRoleRoute } from "../hono-routes/create-role.route.js"
import { getRoleRoute } from "../hono-routes/get-role.route.js"
import { updateRoleRoute } from "../hono-routes/update-role.route.js"
import { deleteRoleRoute } from "../hono-routes/delete-role.route.js"
import { getMemberRolesRoute } from "../hono-routes/get-member-roles.route.js"
import { setMemberRolesRoute } from "../hono-routes/set-member-roles.route.js"
import { myPermissionsRoute } from "../hono-routes/my-permissions.route.js"

describe("role routes", () => {
  const mockUser = { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01" }
  const orgId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02"
  const roleId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03"
  const memberId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04"

  const mockRequireAuth: MiddlewareHandler = async (c, next) => {
    c.set("user", mockUser)
    await next()
  }

  const mockAllowPermission = () => (async (_c: any, next: any) => {
    await next()
  }) as MiddlewareHandler

  const sampleRoleDto = {
    id: roleId,
    orgId,
    name: "Accountant",
    description: "Finance and ledger",
    isSystem: false,
    permissions: [
      {
        effect: "allow" as const,
        resource: "organization",
        action: "read",
        resourceId: "*",
      },
    ],
    assignedCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  describe("permissionCatalogRoute", () => {
    it("returns 200 with catalog", async () => {
      const mockService: any = {
        getCatalog: vi.fn().mockReturnValue(
          ok({
            data: { resources: [] },
            msg: "Permission catalog retrieved",
          })
        ),
      }

      const app = createOpenAPIRouter()
      app.route(
        "/",
        permissionCatalogRoute({
          service: mockService,
          requireAuth: mockRequireAuth,
        })
      )

      const res = await app.request("/permissions/catalog", { method: "GET" })
      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.success).toBe(true)
    })
  })

  describe("roleListRoute", () => {
    it("returns 200 with role list", async () => {
      const mockService: any = {
        list: vi.fn().mockResolvedValue(
          ok({
            data: {
              items: [sampleRoleDto],
              page: 1,
              pageSize: 20,
              total: 1,
            },
            msg: "Roles retrieved",
          })
        ),
      }

      const app = createOpenAPIRouter()
      app.route(
        "/",
        roleListRoute({
          service: mockService,
          requireAuth: mockRequireAuth,
          requirePermission: mockAllowPermission,
        })
      )

      const res = await app.request(`/organizations/${orgId}/roles`, { method: "GET" })
      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.data.items).toHaveLength(1)
    })
  })

  describe("roleOptionsRoute", () => {
    it("returns 200 with role options", async () => {
      const mockService: any = {
        listOptions: vi.fn().mockResolvedValue(
          ok({
            data: {
              items: [{ id: roleId, name: "Accountant" }],
              nextCursor: null,
            },
            msg: "Role options retrieved",
          })
        ),
      }

      const app = createOpenAPIRouter()
      app.route(
        "/",
        roleOptionsRoute({
          service: mockService,
          requireAuth: mockRequireAuth,
          requirePermission: mockAllowPermission,
        })
      )

      const res = await app.request(`/organizations/${orgId}/role-options`, { method: "GET" })
      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.data.items).toHaveLength(1)
    })
  })

  describe("createRoleRoute", () => {
    it("returns 201 on role creation", async () => {
      const mockService: any = {
        create: vi.fn().mockResolvedValue(
          ok({
            data: sampleRoleDto,
            msg: "Role created",
          })
        ),
      }

      const app = createOpenAPIRouter()
      app.route(
        "/",
        createRoleRoute({
          service: mockService,
          requireAuth: mockRequireAuth,
          requirePermission: mockAllowPermission,
        })
      )

      const res = await app.request(`/organizations/${orgId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Accountant",
          description: "Finance",
          permissions: sampleRoleDto.permissions,
        }),
      })

      expect(res.status).toBe(201)
      const json: any = await res.json()
      expect(json.data.name).toBe("Accountant")
    })
  })

  describe("getRoleRoute", () => {
    it("returns 200 on role details", async () => {
      const mockService: any = {
        getById: vi.fn().mockResolvedValue(
          ok({
            data: sampleRoleDto,
            msg: "Role retrieved",
          })
        ),
      }

      const app = createOpenAPIRouter()
      app.route(
        "/",
        getRoleRoute({
          service: mockService,
          requireAuth: mockRequireAuth,
          requirePermission: mockAllowPermission,
        })
      )

      const res = await app.request(`/organizations/${orgId}/roles/${roleId}`, {
        method: "GET",
      })
      expect(res.status).toBe(200)
    })
  })

  describe("updateRoleRoute", () => {
    it("returns 200 on role update", async () => {
      const mockService: any = {
        update: vi.fn().mockResolvedValue(
          ok({
            data: { ...sampleRoleDto, name: "Senior Accountant" },
            msg: "Role updated",
          })
        ),
      }

      const app = createOpenAPIRouter()
      app.route(
        "/",
        updateRoleRoute({
          service: mockService,
          requireAuth: mockRequireAuth,
          requirePermission: mockAllowPermission,
        })
      )

      const res = await app.request(`/organizations/${orgId}/roles/${roleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Senior Accountant" }),
      })
      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.data.name).toBe("Senior Accountant")
    })
  })

  describe("deleteRoleRoute", () => {
    it("returns 200 on role delete", async () => {
      const mockService: any = {
        remove: vi.fn().mockResolvedValue(
          ok({
            data: { id: roleId },
            msg: "Role deleted",
          })
        ),
      }

      const app = createOpenAPIRouter()
      app.route(
        "/",
        deleteRoleRoute({
          service: mockService,
          requireAuth: mockRequireAuth,
          requirePermission: mockAllowPermission,
        })
      )

      const res = await app.request(`/organizations/${orgId}/roles/${roleId}`, {
        method: "DELETE",
      })
      expect(res.status).toBe(200)
    })
  })

  describe("getMemberRolesRoute", () => {
    it("returns 200 with member roles", async () => {
      const mockService: any = {
        getMemberRoles: vi.fn().mockResolvedValue(
          ok({
            data: { memberId, roles: [sampleRoleDto] },
            msg: "Member roles retrieved",
          })
        ),
      }

      const app = createOpenAPIRouter()
      app.route(
        "/",
        getMemberRolesRoute({
          service: mockService,
          requireAuth: mockRequireAuth,
          requirePermission: mockAllowPermission,
        })
      )

      const res = await app.request(`/organizations/${orgId}/members/${memberId}/roles`, {
        method: "GET",
      })
      expect(res.status).toBe(200)
    })
  })

  describe("setMemberRolesRoute", () => {
    it("returns 200 when setting member roles", async () => {
      const mockService: any = {
        setMemberRoles: vi.fn().mockResolvedValue(
          ok({
            data: { memberId, roles: [sampleRoleDto] },
            msg: "Member roles updated",
          })
        ),
      }

      const app = createOpenAPIRouter()
      app.route(
        "/",
        setMemberRolesRoute({
          service: mockService,
          requireAuth: mockRequireAuth,
          requirePermission: mockAllowPermission,
        })
      )

      const res = await app.request(`/organizations/${orgId}/members/${memberId}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleIds: [roleId] }),
      })
      expect(res.status).toBe(200)
    })
  })

  describe("myPermissionsRoute", () => {
    it("returns 200 with caller effective permissions", async () => {
      const mockService: any = {
        myPermissions: vi.fn().mockResolvedValue(
          ok({
            data: { isOwner: false, statements: sampleRoleDto.permissions },
            msg: "Permissions retrieved",
          })
        ),
      }

      const app = createOpenAPIRouter()
      app.route(
        "/",
        myPermissionsRoute({
          service: mockService,
          requireAuth: mockRequireAuth,
        })
      )

      const res = await app.request(`/me/organizations/${orgId}/permissions`, {
        method: "GET",
      })
      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.data.statements).toHaveLength(1)
    })
  })
})
