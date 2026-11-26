import { describe, expect, it, vi } from "vitest"
import type { MiddlewareHandler } from "hono"
import { createOpenAPIRouter } from "@avuny/hono"
import { ok, fail } from "@avuny/utils"
import { createOrganizationInvitationRoute } from "../hono-routes/create-organization-invitation.route.js"
import { OrganizationInvitationErrorCode } from "@avuny/contracts"

describe("createOrganizationInvitationRoute", () => {
  const mockUser = { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01" }

  const mockRequireAuth: MiddlewareHandler = async (c, next) => {
    c.set("user", mockUser)
    await next()
  }

  it("returns 201 when invitation is created with a required role", async () => {
    const mockService: any = {
      create: vi.fn().mockResolvedValue(
        ok({
          data: {
            id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02",
            orgId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03",
            identifier: "test@example.com",
            roleId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04",
            inviteeUserId: null,
            status: "pending",
            invitedBy: mockUser.id,
            expiresAt: new Date().toISOString(),
            respondedAt: null,
            acceptedOrgUserId: null,
            sendCount: 1,
            lastSentAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
          msg: "Invitation created",
        })
      ),
    }

    const app = createOpenAPIRouter()
    app.route(
      "/",
      createOrganizationInvitationRoute({
        service: mockService,
        requireAuth: mockRequireAuth,
      })
    )

    const orgId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03"
    const roleId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04"

    const res = await app.request(`/organizations/${orgId}/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: "test@example.com",
        roleId,
      }),
    })

    expect(res.status).toBe(201)
    const json = (await res.json()) as any
    expect(json.success).toBe(true)
    expect(json.data.roleId).toBe(roleId)
    expect(mockService.create).toHaveBeenCalledWith(
      mockUser.id,
      orgId,
      expect.objectContaining({ identifier: "test@example.com", roleId })
    )
  })

  it("returns 422 validation error when roleId is missing", async () => {
    const mockService: any = { create: vi.fn() }
    const app = createOpenAPIRouter()
    app.route(
      "/",
      createOrganizationInvitationRoute({
        service: mockService,
        requireAuth: mockRequireAuth,
      })
    )

    const orgId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03"

    const res = await app.request(`/organizations/${orgId}/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: "test@example.com",
      }),
    })

    expect(res.status).toBe(422)
    expect(mockService.create).not.toHaveBeenCalled()
  })

  it("returns 404 when role is not found in service", async () => {
    const mockService: any = {
      create: vi.fn().mockResolvedValue(
        fail({
          error: OrganizationInvitationErrorCode.ORGANIZATION_INVITATION_ROLE_NOT_FOUND,
          msg: "Role not found",
        })
      ),
    }

    const app = createOpenAPIRouter()
    app.route(
      "/",
      createOrganizationInvitationRoute({
        service: mockService,
        requireAuth: mockRequireAuth,
      })
    )

    const orgId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03"
    const roleId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04"

    const res = await app.request(`/organizations/${orgId}/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: "test@example.com",
        roleId,
      }),
    })

    expect(res.status).toBe(404)
    const json = (await res.json()) as any
    expect(json.success).toBe(false)
  })
})
