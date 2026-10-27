import { describe, expect, it } from "vitest"
import { Hono } from "hono"
import { geoRoutes } from "../hono-routes/index.js"

describe("Geo Hono Routes", () => {
  const app = new Hono()
  app.route("/geo", geoRoutes)

  it("GET /geo/countries returns 200 with list of countries", async () => {
    const res = await app.request("/geo/countries")
    expect(res.status).toBe(200)
    const json = (await res.json()) as any
    expect(json.success).toBe(true)
    expect(Array.isArray(json.data)).toBe(true)
    if (json.data.length > 0) {
      expect(json.data[0]).toHaveProperty("code")
      expect(json.data[0]).toHaveProperty("name")
    }
  })

  it("GET /geo/countries/EG returns 200 with Egypt details and timezones", async () => {
    const res = await app.request("/geo/countries/EG")
    expect(res.status).toBe(200)
    const json = (await res.json()) as any
    expect(json.success).toBe(true)
    expect(json.data.code).toBe("EG")
    expect(Array.isArray(json.data.timezones)).toBe(true)
    expect(json.data.timezones).toContain("Africa/Cairo")
  })

  it("GET /geo/countries/ZZ returns 404 for unknown country", async () => {
    const res = await app.request("/geo/countries/ZZ")
    expect(res.status).toBe(404)
    const json = (await res.json()) as any
    expect(json.success).toBe(false)
  })

  it("GET /geo/countries/EG/states returns 200 with states", async () => {
    const res = await app.request("/geo/countries/EG/states")
    expect(res.status).toBe(200)
    const json = (await res.json()) as any
    expect(json.success).toBe(true)
    expect(Array.isArray(json.data)).toBe(true)
    if (json.data.length > 0) {
      expect(json.data[0]).toHaveProperty("countryCode", "EG")
    }
  })

  it("GET /geo/currencies returns 200 with list of currencies", async () => {
    const res = await app.request("/geo/currencies")
    expect(res.status).toBe(200)
    const json = (await res.json()) as any
    expect(json.success).toBe(true)
    expect(Array.isArray(json.data)).toBe(true)
    const egp = json.data.find((c: { code: string }) => c.code === "EGP")
    expect(egp).toBeDefined()
  })

  it("GET /geo/timezones returns 200 with list of timezones", async () => {
    const res = await app.request("/geo/timezones?countryCode=EG")
    expect(res.status).toBe(200)
    const json = (await res.json()) as any
    expect(json.success).toBe(true)
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data).toEqual(expect.arrayContaining([{ name: "Africa/Cairo" }]))
  })
})
