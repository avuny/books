import { describe, expect, it, vi } from "vitest"
import type { MiddlewareHandler } from "hono"
import { createOpenAPIRouter } from "@avuny/hono"
import { ok, fail } from "@avuny/utils"
import { OrganizationUserErrorCode } from "@avuny/contracts"
import { myOrganizationListRoute } from "../hono-routes/my-organization-list.route.js"
import { organizationUserListRoute } from "../hono-routes/organization-user-list.route.js"
import { touchOrganizationMembershipRoute } from "../hono-routes/touch-organization-membership.route.js"
import { updateOrganizationUserRoute } from "../hono-routes/update-organization-user.route.js"
import { setOrganizationUserStatusRoute } from "../hono-routes/set-organization-user-status.route.js"
import { transferOrganizationOwnershipRoute } from "../hono-routes/transfer-organization-ownership.route.js"

describe("organization-user routes", () => {
  const mockUser = { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01" }
  const orgId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02"
  const memberId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03"

  const mockRequireAuth: MiddlewareHandler = async (c, next) => {
    c.set("user", mockUser)
    await next()
  }

  const sampleMemberDto = {
    id: memberId,
    orgId,
    userId: mockUser.id,
    type: "managed" as const,
    username: "john_doe",
    isActive: true,
    lastAccessedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }

  describe("myOrganizationListRoute", () => {
    it("returns 200 with list of user organizations", async () => {
      const mockService: any = {
        listMine: vi.fn().mockResolvedValue(
          ok({
            data: {
              items: [
                {
                  membershipId: memberId,
                  orgId,
                  code: "acme",
                  name: "Acme Corp",
                  orgStatus: "active",
                  lastAccessedAt: new Date().toISOString(),
                },
              ],
            },
            msg: "Organizations retrieved",
          })
        ),
      }

      const app = createOpenAPIRouter()
      app.route(
        "/",
        myOrganizationListRoute({
          service: mockService,
          requireAuth: mockRequireAuth,
        })
      )

      const res = await app.request("/me/organizations", { method: "GET" })
      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.items).toHaveLength(1)
    })
  })

  describe("organizationUserListRoute", () => {
    it("returns 200 with member list", async () => {
      const mockService: any = {
        list: vi.fn().mockResolvedValue(
          ok({
            data: {
              items: [sampleMemberDto],
              page: 1,
              pageSize: 20,
              total: 1,
            },
            msg: "Members retrieved",
          })
        ),
      }

      const app = createOpenAPIRouter()
      app.route(
        "/",
        organizationUserListRoute({
          service: mockService,
          requireAuth: mockRequireAuth,
        })
      )

      const res = await app.request(`/organizations/${orgId}/members?page=1&pageSize=20`, {
        method: "GET",
      })
      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.items).toHaveLength(1)
    })

    it("returns 403 when forbidden", async () => {
      const mockService: any = {
        list: vi.fn().mockResolvedValue(
          fail({
            error: OrganizationUserErrorCode.ORGANIZATION_USER_FORBIDDEN,
            msg: "Forbidden",
          })
        ),
      }

      const app = createOpenAPIRouter()
      app.route(
        "/",
        organizationUserListRoute({
          service: mockService,
          requireAuth: mockRequireAuth,
        })
      )

      const res = await app.request(`/organizations/${orgId}/members`, {
        method: "GET",
      })
      expect(res.status).toBe(403)
      const json: any = await res.json()
      expect(json.code).toBe(OrganizationUserErrorCode.ORGANIZATION_USER_FORBIDDEN)
    })
  })

  describe("touchOrganizationMembershipRoute", () => {
    it("returns 200 on touch", async () => {
      const mockService: any = {
        touch: vi.fn().mockResolvedValue(
          ok({
            data: { lastAccessedAt: new Date().toISOString() },
            msg: "Membership updated",
          })
        ),
      }

      const app = createOpenAPIRouter()
      app.route(
        "/",
        touchOrganizationMembershipRoute({
          service: mockService,
          requireAuth: mockRequireAuth,
        })
      )

      const res = await app.request(`/me/organizations/${orgId}/touch`, {
        method: "POST",
      })
      expect(res.status).toBe(200)
    })
  })

  describe("updateOrganizationUserRoute", () => {
    it("returns 200 on username change", async () => {
      const mockService: any = {
        updateUsername: vi.fn().mockResolvedValue(
          ok({
            data: { ...sampleMemberDto, username: "new_username" },
            msg: "Username updated",
          })
        ),
      }

      const app = createOpenAPIRouter()
      app.route(
        "/",
        updateOrganizationUserRoute({
          service: mockService,
          requireAuth: mockRequireAuth,
        })
      )

      const res = await app.request(`/organizations/${orgId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "new_username" }),
      })
      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.data.username).toBe("new_username")
    })
  })

  describe("setOrganizationUserStatusRoute", () => {
    it("returns 200 on status change", async () => {
      const mockService: any = {
        setStatus: vi.fn().mockResolvedValue(
          ok({
            data: { ...sampleMemberDto, isActive: false },
            msg: "Member deactivated",
          })
        ),
      }

      const app = createOpenAPIRouter()
      app.route(
        "/",
        setOrganizationUserStatusRoute({
          service: mockService,
          requireAuth: mockRequireAuth,
        })
      )

      const res = await app.request(`/organizations/${orgId}/members/${memberId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      })
      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.data.isActive).toBe(false)
    })
  })

  describe("transferOrganizationOwnershipRoute", () => {
    it("returns 200 on ownership transfer", async () => {
      const newOwnerId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04"
      const mockService: any = {
        transferOwnership: vi.fn().mockResolvedValue(
          ok({
            data: { ...sampleMemberDto, id: newOwnerId, type: "owner" },
            msg: "Ownership transferred",
          })
        ),
      }

      const app = createOpenAPIRouter()
      app.route(
        "/",
        transferOrganizationOwnershipRoute({
          service: mockService,
          requireAuth: mockRequireAuth,
        })
      )

      const res = await app.request(`/organizations/${orgId}/ownership-transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newOwnerMemberId: newOwnerId,
          confirmCode: "acme",
        }),
      })
      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.data.type).toBe("owner")
    })
  })
})

