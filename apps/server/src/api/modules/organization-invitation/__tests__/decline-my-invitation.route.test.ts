import { describe, expect, it, vi } from "vitest"
import type { MiddlewareHandler } from "hono"
import { createOpenAPIRouter } from "@avuny/hono"
import { ok, fail } from "@avuny/utils"
import { declineMyInvitationRoute } from "../hono-routes/decline-my-invitation.route.js"
import { OrganizationInvitationErrorCode } from "@avuny/contracts"

describe("declineMyInvitationRoute", () => {
  const mockUser = { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01" }

  const mockRequireAuth: MiddlewareHandler = async (c, next) => {
    c.set("user", mockUser)
    await next()
  }

  it("returns 200 when user declines invitation from inbox", async () => {
    const mockService: any = {
      decline: vi.fn().mockResolvedValue(
        ok({
          data: {
            id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02",
            orgId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03",
            identifier: "test@example.com",
            roleId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04",
            inviteeUserId: mockUser.id,
            status: "declined",
            invitedBy: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05",
            expiresAt: new Date().toISOString(),
            respondedAt: new Date().toISOString(),
            acceptedOrgUserId: null,
            sendCount: 1,
            lastSentAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
          msg: "Invitation declined",
        })
      ),
    }

    const app = createOpenAPIRouter()
    app.route(
      "/",
      declineMyInvitationRoute({
        service: mockService,
        requireAuth: mockRequireAuth,
      })
    )

    const invitationId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02"
    const res = await app.request(`/me/invitations/${invitationId}/decline`, {
      method: "POST",
    })

    expect(res.status).toBe(200)
    const json = (await res.json()) as any
    expect(json.success).toBe(true)
    expect(mockService.decline).toHaveBeenCalledWith(mockUser.id, invitationId)
  })

  it("returns 404 when invitation not found", async () => {
    const mockService: any = {
      decline: vi.fn().mockResolvedValue(
        fail({
          error: OrganizationInvitationErrorCode.ORGANIZATION_INVITATION_NOT_FOUND,
          msg: "Not found",
        })
      ),
    }

    const app = createOpenAPIRouter()
    app.route(
      "/",
      declineMyInvitationRoute({
        service: mockService,
        requireAuth: mockRequireAuth,
      })
    )

    const invitationId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02"
    const res = await app.request(`/me/invitations/${invitationId}/decline`, {
      method: "POST",
    })

    expect(res.status).toBe(404)
    const json = (await res.json()) as any
    expect(json.success).toBe(false)
  })
})
