import { describe, expect, it, vi } from "vitest"
import type { MiddlewareHandler } from "hono"
import { createOpenAPIRouter } from "@avuny/hono"
import { ok } from "@avuny/utils"
import { myInvitationListRoute } from "../hono-routes/my-invitation-list.route.js"

describe("myInvitationListRoute", () => {
  const mockUser = { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01" }

  const mockRequireAuth: MiddlewareHandler = async (c, next) => {
    c.set("user", mockUser)
    await next()
  }

  it("returns 200 with list of user's invitations", async () => {
    const mockService: any = {
      listMine: vi.fn().mockResolvedValue(
        ok({
          data: { items: [] },
          msg: "Invitations retrieved",
        })
      ),
    }

    const app = createOpenAPIRouter()
    app.route(
      "/",
      myInvitationListRoute({
        service: mockService,
        requireAuth: mockRequireAuth,
      })
    )

    const res = await app.request("/me/invitations", {
      method: "GET",
    })

    expect(res.status).toBe(200)
    const json = (await res.json()) as any
    expect(json.success).toBe(true)
    expect(mockService.listMine).toHaveBeenCalledWith(mockUser.id)
  })
})
