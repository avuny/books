import { beforeAll, describe, expect, it } from "vitest"
import { PLATFORM_AUTH_ROUTE_ACCESS } from "./modules/platform-auth/platform-auth.permissions.js"

/**
 * Route inventory tests (A1-04: PAC1, PA-R7).
 * The inventory comes from the app's own OpenAPI document, so a route can never
 * sneak past the declarations: every route must declare its access level, no
 * route may be a public registration endpoint, and no route may create a
 * platform admin outside invite acceptance or the bootstrap CLI.
 */

/** Platform infra routes that are not module routes (health probe). */
const INFRA_ROUTES = new Set(["GET /health"])

/** Access declarations from every module, merged as modules land (A1-05+). */
const ROUTE_ACCESS: Record<string, string> = {
  ...PLATFORM_AUTH_ROUTE_ACCESS,
}

type OpenApiDoc = { paths: Record<string, Record<string, unknown>> }

let inventory: string[]

beforeAll(async () => {
  process.env.PLATFORM_AUTH_TICKET_SECRET ??=
    "unit-ticket-secret-0123456789abcdef0123456789abcdef"
  process.env.PLATFORM_TOTP_ENC_KEY ??=
    "unit-totp-enc-key-0123456789abcdef0123456789abcdef"
  const { app } = await import("./routes.js")
  const res = await app.request("/api/openapi.json")
  expect(res.status).toBe(200)
  const doc = (await res.json()) as OpenApiDoc
  // The OpenAPI doc carries the /api base path; declarations are base-relative.
  inventory = Object.entries(doc.paths).flatMap(([path, methods]) =>
    Object.keys(methods).map(
      (method) => `${method.toUpperCase()} ${path.replace(/^\/api/, "")}`
    )
  )
  expect(inventory.length).toBeGreaterThan(0)
})

describe("route inventory (PAC1, PA-R7)", () => {
  it("has no registration or sign-up route of any kind (PAC1)", () => {
    const registration = inventory.filter((route) =>
      /register|sign[-_]?up/i.test(route)
    )
    expect(registration).toEqual([])
  })

  it("creates admins only through invite acceptance (PAC1)", () => {
    const adminCreating = inventory.filter(
      (route) => /admins?\b/i.test(route) && route.startsWith("POST")
    )
    expect(adminCreating).toEqual([])
  })

  it("declares an access level for every route (PA-R7)", () => {
    const undeclared = inventory.filter(
      (route) => !(route in ROUTE_ACCESS) && !INFRA_ROUTES.has(route)
    )
    expect(undeclared).toEqual([])
  })

  it("keeps the declarations in sync with the inventory", () => {
    const known = new Set([...inventory, ...INFRA_ROUTES])
    const stale = Object.keys(ROUTE_ACCESS).filter((route) => !known.has(route))
    expect(stale).toEqual([])
  })
})
