import { describe, expect, it, vi } from "vitest"
import type { MiddlewareHandler } from "hono"
import { createOpenAPIRouter } from "@avuny/hono"
import { ok, fail } from "@avuny/utils"
import { organizationInvitationListRoute } from "../hono-routes/organization-invitation-list.route.js"
import { OrganizationInvitationErrorCode } from "@avuny/contracts"

describe("organizationInvitationListRoute", () => {
  const mockUser = { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01" }

  const mockRequireAuth: MiddlewareHandler = async (c, next) => {
    c.set("user", mockUser)
    await next()
  }

  it("returns 200 with list of invitations", async () => {
    const mockService: any = {
      list: vi.fn().mockResolvedValue(
        ok({
          data: {
            items: [],
            page: 1,
            pageSize: 20,
            total: 0,
          },
          msg: "Invitations retrieved",
        })
      ),
    }

    const app = createOpenAPIRouter()
    app.route(
      "/",
      organizationInvitationListRoute({
        service: mockService,
        requireAuth: mockRequireAuth,
      })
    )

    const orgId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03"
    const res = await app.request(`/organizations/${orgId}/invitations?page=1&pageSize=20`, {
      method: "GET",
    })

    expect(res.status).toBe(200)
    const json = (await res.json()) as any
    expect(json.success).toBe(true)
    expect(mockService.list).toHaveBeenCalledWith(
      mockUser.id,
      orgId,
      expect.objectContaining({ page: 1, pageSize: 20 })
    )
  })

  it("returns 403 when forbidden", async () => {
    const mockService: any = {
      list: vi.fn().mockResolvedValue(
        fail({
          error: OrganizationInvitationErrorCode.ORGANIZATION_INVITATION_FORBIDDEN,
          msg: "Forbidden",
        })
      ),
    }

    const app = createOpenAPIRouter()
    app.route(
      "/",
      organizationInvitationListRoute({
        service: mockService,
        requireAuth: mockRequireAuth,
      })
    )

    const orgId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03"
    const res = await app.request(`/organizations/${orgId}/invitations`, {
      method: "GET",
    })

    expect(res.status).toBe(403)
    const json = (await res.json()) as any
    expect(json.success).toBe(false)
  })
})

