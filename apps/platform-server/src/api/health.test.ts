import { describe, expect, it } from "vitest"
import { app } from "./routes.js"

describe("Platform health route", () => {
  it("GET /api/health returns 200 with status ok", async () => {
    const response = await app.request("/api/health")

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toMatch(/^application\/json/)

    const body = (await response.json()) as Record<string, unknown>
    expect(body).toEqual(
      expect.objectContaining({ status: "ok", service: "platform", timestamp: expect.any(String) })
    )
    expect(Number.isNaN(new Date(String(body.timestamp)).getTime())).toBe(false)
  })

  it("returns the standard 404 body for an unknown route", async () => {
    const response = await app.request("/api/unknown")

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual(
      expect.objectContaining({ success: false, code: "NOT_FOUND" })
    )
  })
})
