// NEW: packages/hono/src/result/handle-result.test.ts
import { describe, expect, it, vi } from "vitest"
import { Hono } from "hono"
import { fail, ok, type Result } from "@avuny/utils"
import { createResultHandler } from "./handle-result.js"
import { defineErrorMap } from "./error-map.js"

const errorMap = defineErrorMap("users", {
  NOT_FOUND: { statusCode: 404, responseMessage: "User not found" },
})

type Handler = ReturnType<typeof createResultHandler>

async function run(handleResult: Handler, result: Result<{ id: string }, "NOT_FOUND">) {
  const app = new Hono()
  app.get("/", (c) => handleResult(c, result, { successStatus: 200, errorMap }))
  const res = await app.request("/")
  return { status: res.status, body: await res.json() }
}

describe("handleResult", () => {
  it("returns the success envelope", async () => {
    const { status, body } = await run(createResultHandler(), ok({ data: { id: "u1" } }))
    expect(status).toBe(200)
    expect(body).toEqual({ success: true, data: { id: "u1" } })
  })

  it("maps a domain error and falls back to responseMessage", async () => {
    const { status, body } = await run(
      createResultHandler(),
      fail({ error: "NOT_FOUND", msg: "no row" }),
    )
    expect(status).toBe(404)
    expect(body).toEqual({
      success: false,
      code: "NOT_FOUND",
      message: "User not found",
      type: "domain",
    })
  })

  it("uses the translated message when a translator is provided", async () => {
    const translate = vi.fn(() => "Usuario no encontrado")
    const { body } = await run(
      createResultHandler({ translate }),
      fail({ error: "NOT_FOUND", msg: "no row" }),
    )
    expect(translate).toHaveBeenCalledWith("users:errors.NOT_FOUND")
    expect(body.message).toBe("Usuario no encontrado")
  })
})
