import { describe, expect, it, vi } from "vitest"
import type { MiddlewareHandler } from "hono"
import { createOpenAPIRouter } from "@avuny/hono"
import { ok, fail } from "@avuny/utils"
import { revokeOrganizationInvitationRoute } from "../hono-routes/revoke-organization-invitation.route.js"
import { OrganizationInvitationErrorCode } from "@avuny/contracts"

describe("revokeOrganizationInvitationRoute", () => {
  const mockUser = { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01" }

  const mockRequireAuth: MiddlewareHandler = async (c, next) => {
    c.set("user", mockUser)
    await next()
  }

  it("returns 200 when invitation is revoked", async () => {
    const mockService: any = {
      revoke: vi.fn().mockResolvedValue(
        ok({
          data: {
            id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02",
            orgId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03",
            identifier: "test@example.com",
            roleId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04",
            inviteeUserId: null,
            status: "revoked",
            invitedBy: mockUser.id,
            expiresAt: new Date().toISOString(),
            respondedAt: new Date().toISOString(),
            acceptedOrgUserId: null,
            sendCount: 1,
            lastSentAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
          msg: "Invitation revoked",
        })
      ),
    }

    const app = createOpenAPIRouter()
    app.route(
      "/",
      revokeOrganizationInvitationRoute({
        service: mockService,
        requireAuth: mockRequireAuth,
      })
    )

    const orgId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03"
    const invitationId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02"

    const res = await app.request(
      `/organizations/${orgId}/invitations/${invitationId}/revoke`,
      { method: "POST" }
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as any
    expect(json.success).toBe(true)
    expect(mockService.revoke).toHaveBeenCalledWith(mockUser.id, orgId, invitationId)
  })

  it("returns 404 when invitation not found", async () => {
    const mockService: any = {
      revoke: vi.fn().mockResolvedValue(
        fail({
          error: OrganizationInvitationErrorCode.ORGANIZATION_INVITATION_NOT_FOUND,
          msg: "Not found",
        })
      ),
    }

    const app = createOpenAPIRouter()
    app.route(
      "/",
      revokeOrganizationInvitationRoute({
        service: mockService,
        requireAuth: mockRequireAuth,
      })
    )

    const orgId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03"
    const invitationId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02"

    const res = await app.request(
      `/organizations/${orgId}/invitations/${invitationId}/revoke`,
      { method: "POST" }
    )

    expect(res.status).toBe(404)
    const json = (await res.json()) as any
    expect(json.success).toBe(false)
  })
})
