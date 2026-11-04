import { describe, expect, it, vi } from "vitest"
import { createOpenAPIRouter } from "@avuny/hono"
import { ok, fail } from "@avuny/utils"
import { previewOrganizationInvitationRoute } from "../hono-routes/preview-organization-invitation.route.js"
import { OrganizationInvitationErrorCode } from "@avuny/contracts"

describe("previewOrganizationInvitationRoute", () => {
  it("returns 200 with preview data for valid token", async () => {
    const mockService: any = {
      preview: vi.fn().mockResolvedValue(
        ok({
          data: {
            orgCode: "acme",
            orgName: "Acme Corp",
            identifier: "test@example.com",
            roleId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04",
            expiresAt: new Date().toISOString(),
          },
          msg: "Invitation preview",
        })
      ),
    }

    const app = createOpenAPIRouter()
    app.route(
      "/",
      previewOrganizationInvitationRoute({
        service: mockService,
        requireAuth: vi.fn() as any,
      })
    )

    const res = await app.request("/invitations/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "valid-invitation-token-1234567890" }),
    })

    expect(res.status).toBe(200)
    const json = (await res.json()) as any
    expect(json.success).toBe(true)
    expect(json.data.orgCode).toBe("acme")
    expect(mockService.preview).toHaveBeenCalledWith("valid-invitation-token-1234567890")
  })

  it("returns 404 when token is not found", async () => {
    const mockService: any = {
      preview: vi.fn().mockResolvedValue(
        fail({
          error: OrganizationInvitationErrorCode.ORGANIZATION_INVITATION_NOT_FOUND,
          msg: "Invitation not found",
        })
      ),
    }

    const app = createOpenAPIRouter()
    app.route(
      "/",
      previewOrganizationInvitationRoute({
        service: mockService,
        requireAuth: vi.fn() as any,
      })
    )

    const res = await app.request("/invitations/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "nonexistent-token-1234567890" }),
    })

    expect(res.status).toBe(404)
    const json = (await res.json()) as any
    expect(json.success).toBe(false)
  })
})
