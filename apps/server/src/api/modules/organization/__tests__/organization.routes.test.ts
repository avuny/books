import { describe, expect, it, vi } from "vitest"
import type { MiddlewareHandler } from "hono"
import { createOpenAPIRouter } from "@avuny/hono"
import { ok, fail } from "@avuny/utils"
import { OrganizationErrorCode } from "@avuny/contracts"
import { createOrganizationRoute } from "../hono-routes/create-organization.route.js"
import { getOrganizationRoute } from "../hono-routes/get-organization.route.js"
import { updateOrganizationRoute } from "../hono-routes/update-organization.route.js"
import { organizationListRoute } from "../hono-routes/organization-list.route.js"

describe("organization routes", () => {
  const mockUser = { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01" }

  const mockRequireAuth: MiddlewareHandler = async (c, next) => {
    c.set("user", mockUser)
    await next()
  }

  const sampleOrgDto = {
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02",
    code: "acme",
    name: "Acme Corp",
    status: "active" as const,
    countryCode: "US",
    stateId: null,
    defaultCurrency: "USD",
    timezone: "UTC",
  }

  describe("createOrganizationRoute", () => {
    it("returns 201 on successful creation", async () => {
      const mockService: any = {
        create: vi.fn().mockResolvedValue(
          ok({
            data: sampleOrgDto,
            msg: "Organization created successfully",
          })
        ),
      }

      const app = createOpenAPIRouter()
      app.route(
        "/",
        createOrganizationRoute({
          service: mockService,
          requireAuth: mockRequireAuth,
        })
      )

      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Acme Corp",
          code: "acme",
          countryCode: "US",
          defaultCurrency: "USD",
          timezone: "UTC",
          ownerUsername: "owner",
        }),
      })

      expect(res.status).toBe(201)
      const json: any = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.code).toBe("acme")
    })

    it("returns 403 when forbidden", async () => {
      const mockService: any = {
        create: vi.fn().mockResolvedValue(
          fail({
            error: OrganizationErrorCode.ORGANIZATION_FORBIDDEN,
            msg: "Forbidden",
          })
        ),
      }

      const app = createOpenAPIRouter()
      app.route(
        "/",
        createOrganizationRoute({
          service: mockService,
          requireAuth: mockRequireAuth,
        })
      )

      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Acme Corp",
          code: "acme",
          countryCode: "US",
          defaultCurrency: "USD",
          timezone: "UTC",
          ownerUsername: "owner",
        }),
      })

      expect(res.status).toBe(403)
      const json: any = await res.json()
      expect(json.success).toBe(false)
      expect(json.code).toBe(OrganizationErrorCode.ORGANIZATION_FORBIDDEN)
    })

    it("returns 409 when limit reached", async () => {
      const mockService: any = {
        create: vi.fn().mockResolvedValue(
          fail({
            error: OrganizationErrorCode.ORGANIZATION_LIMIT_REACHED,
            msg: "Limit reached",
          })
        ),
      }

      const app = createOpenAPIRouter()
      app.route(
        "/",
        createOrganizationRoute({
          service: mockService,
          requireAuth: mockRequireAuth,
        })
      )

      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Acme Corp",
          code: "acme",
          countryCode: "US",
          defaultCurrency: "USD",
          timezone: "UTC",
          ownerUsername: "owner",
        }),
      })

      expect(res.status).toBe(409)
      const json: any = await res.json()
      expect(json.code).toBe(OrganizationErrorCode.ORGANIZATION_LIMIT_REACHED)
    })
  })

  describe("getOrganizationRoute", () => {
    it("returns 200 on success", async () => {
      const mockService: any = {
        getById: vi.fn().mockResolvedValue(
          ok({
            data: sampleOrgDto,
            msg: "Organization retrieved successfully",
          })
        ),
      }

      const app = createOpenAPIRouter()
      app.route(
        "/",
        getOrganizationRoute({
          service: mockService,
          requireAuth: mockRequireAuth,
        })
      )

      const res = await app.request(`/${sampleOrgDto.id}`, {
        method: "GET",
      })

      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.id).toBe(sampleOrgDto.id)
    })

    it("returns 404 when not found", async () => {
      const mockService: any = {
        getById: vi.fn().mockResolvedValue(
          fail({
            error: OrganizationErrorCode.ORGANIZATION_NOT_FOUND,
            msg: "Organization not found",
          })
        ),
      }

      const app = createOpenAPIRouter()
      app.route(
        "/",
        getOrganizationRoute({
          service: mockService,
          requireAuth: mockRequireAuth,
        })
      )

      const res = await app.request(`/${sampleOrgDto.id}`, {
        method: "GET",
      })

      expect(res.status).toBe(404)
      const json: any = await res.json()
      expect(json.code).toBe(OrganizationErrorCode.ORGANIZATION_NOT_FOUND)
    })
  })

  describe("updateOrganizationRoute", () => {
    it("returns 200 on success", async () => {
      const mockService: any = {
        update: vi.fn().mockResolvedValue(
          ok({
            data: { ...sampleOrgDto, name: "Acme Updated" },
            msg: "Organization updated successfully",
          })
        ),
      }

      const app = createOpenAPIRouter()
      app.route(
        "/",
        updateOrganizationRoute({
          service: mockService,
          requireAuth: mockRequireAuth,
        })
      )

      const res = await app.request(`/${sampleOrgDto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Acme Updated" }),
      })

      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.data.name).toBe("Acme Updated")
    })
  })

  describe("organizationListRoute", () => {
    it("returns 200 with offset items", async () => {
      const mockService: any = {
        getOffsetPaginationList: vi.fn().mockResolvedValue(
          ok({
            data: {
              items: [sampleOrgDto],
              page: 1,
              pageSize: 20,
              total: 1,
              totalPages: 1,
            },
            msg: "Organizations retrieved successfully",
          })
        ),
      }

      const app = createOpenAPIRouter()
      app.route(
        "/",
        organizationListRoute({
          service: mockService,
          requireAuth: mockRequireAuth,
        })
      )

      const res = await app.request("/?page=1&pageSize=20", {
        method: "GET",
      })

      expect(res.status).toBe(200)
      const json: any = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.items).toHaveLength(1)
    })
  })
})
