import { describe, expect, it, vi } from "vitest"
import type { MiddlewareHandler } from "hono"
import { createOpenAPIRouter } from "@avuny/hono"
import { ok, fail } from "@avuny/utils"
import { acceptMyInvitationRoute } from "../hono-routes/accept-my-invitation.route.js"
import { OrganizationInvitationErrorCode } from "@avuny/contracts"

describe("acceptMyInvitationRoute", () => {
  const mockUser = { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01" }

  const mockRequireAuth: MiddlewareHandler = async (c, next) => {
    c.set("user", mockUser)
    await next()
  }

  it("returns 200 when user accepts invitation from inbox", async () => {
    const mockService: any = {
      acceptMine: vi.fn().mockResolvedValue(
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
            lastAccessedAt: new Date().toISOString(),
          },
          msg: "You joined the organization",
        })
      ),
    }

    const app = createOpenAPIRouter()
    app.route(
      "/",
      acceptMyInvitationRoute({
        service: mockService,
        requireAuth: mockRequireAuth,
      })
    )

    const invitationId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02"
    const res = await app.request(`/me/invitations/${invitationId}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(200)
    const json = (await res.json()) as any
    expect(json.success).toBe(true)
    expect(mockService.acceptMine).toHaveBeenCalledWith(
      mockUser.id,
      invitationId,
      expect.anything()
    )
  })

  it("returns 404 when invitation not found", async () => {
    const mockService: any = {
      acceptMine: vi.fn().mockResolvedValue(
        fail({
          error: OrganizationInvitationErrorCode.ORGANIZATION_INVITATION_NOT_FOUND,
          msg: "Not found",
        })
      ),
    }

    const app = createOpenAPIRouter()
    app.route(
      "/",
      acceptMyInvitationRoute({
        service: mockService,
        requireAuth: mockRequireAuth,
      })
    )

    const invitationId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02"
    const res = await app.request(`/me/invitations/${invitationId}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(404)
    const json = (await res.json()) as any
    expect(json.success).toBe(false)
  })
})
