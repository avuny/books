import { describe, expect, it, vi } from "vitest"
import type { MiddlewareHandler } from "hono"
import { createOpenAPIRouter } from "@avuny/hono"
import { ok, fail } from "@avuny/utils"
import { resendOrganizationInvitationRoute } from "../hono-routes/resend-organization-invitation.route.js"
import { OrganizationInvitationErrorCode } from "@avuny/contracts"

describe("resendOrganizationInvitationRoute", () => {
  const mockUser = { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01" }

  const mockRequireAuth: MiddlewareHandler = async (c, next) => {
    c.set("user", mockUser)
    await next()
  }

  it("returns 200 when invitation is resent", async () => {
    const mockService: any = {
      resend: vi.fn().mockResolvedValue(
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
            sendCount: 2,
            lastSentAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
          msg: "Invitation resent",
        })
      ),
    }

    const app = createOpenAPIRouter()
    app.route(
      "/",
      resendOrganizationInvitationRoute({
        service: mockService,
        requireAuth: mockRequireAuth,
      })
    )

    const orgId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03"
    const invitationId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02"

    const res = await app.request(
      `/organizations/${orgId}/invitations/${invitationId}/resend`,
      { method: "POST" }
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as any
    expect(json.success).toBe(true)
    expect(mockService.resend).toHaveBeenCalledWith(mockUser.id, orgId, invitationId)
  })

  it("returns 429 when cooldown is active", async () => {
    const mockService: any = {
      resend: vi.fn().mockResolvedValue(
        fail({
          error: OrganizationInvitationErrorCode.ORGANIZATION_INVITATION_RESEND_TOO_SOON,
          msg: "Too soon",
        })
      ),
    }

    const app = createOpenAPIRouter()
    app.route(
      "/",
      resendOrganizationInvitationRoute({
        service: mockService,
        requireAuth: mockRequireAuth,
      })
    )

    const orgId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03"
    const invitationId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02"

    const res = await app.request(
      `/organizations/${orgId}/invitations/${invitationId}/resend`,
      { method: "POST" }
    )

    expect(res.status).toBe(429)
    const json = (await res.json()) as any
    expect(json.success).toBe(false)
  })
})

