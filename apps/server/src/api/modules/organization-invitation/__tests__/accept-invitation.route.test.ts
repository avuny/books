import { describe, expect, it, vi } from "vitest"
import type { MiddlewareHandler } from "hono"
import { createOpenAPIRouter } from "@avuny/hono"
import { ok, fail } from "@avuny/utils"
import { acceptOrganizationInvitationRoute } from "../hono-routes/accept-organization-invitation.route.js"
import { OrganizationInvitationErrorCode } from "@avuny/contracts"

describe("acceptOrganizationInvitationRoute", () => {
  const mockUser = { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01" }

  const mockRequireAuth: MiddlewareHandler = async (c, next) => {
    c.set("user", mockUser)
    await next()
  }

  it("returns 200 when user successfully accepts invitation by token", async () => {
    const mockService: any = {
      acceptByToken: vi.fn().mockResolvedValue(
        ok({
          data: {
            id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02",
            orgId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03",
            userId: mockUser.id,
            type: "managed",
            username: "testuser",
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          msg: "You joined the organization",
        })
      ),
    }

    const app = createOpenAPIRouter()
    app.route(
      "/",
      acceptOrganizationInvitationRoute({
        service: mockService,
        requireAuth: mockRequireAuth,
      })
    )

    const res = await app.request("/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "valid-invitation-token-1234567890" }),
    })

    expect(res.status).toBe(200)
    const json = (await res.json()) as any
    expect(json.success).toBe(true)
    expect(json.data.userId).toBe(mockUser.id)
    expect(mockService.acceptByToken).toHaveBeenCalledWith(
      mockUser.id,
      expect.objectContaining({ token: "valid-invitation-token-1234567890" })
    )
  })

  it("returns 403 when user verified contact does not match the invitation", async () => {
    const mockService: any = {
      acceptByToken: vi.fn().mockResolvedValue(
        fail({
          error: OrganizationInvitationErrorCode.ORGANIZATION_INVITATION_IDENTITY_MISMATCH,
          msg: "This invitation was sent to a different verified email",
        })
      ),
    }

    const app = createOpenAPIRouter()
    app.route(
      "/",
      acceptOrganizationInvitationRoute({
        service: mockService,
        requireAuth: mockRequireAuth,
      })
    )

    const res = await app.request("/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "valid-invitation-token-1234567890" }),
    })

    expect(res.status).toBe(403)
    const json = (await res.json()) as any
    expect(json.success).toBe(false)
  })
})
