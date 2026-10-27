import { describe, expect, it } from "vitest"
import { fill, parseApiError, resolveErrorMessage, unwrap } from "./api-error"

describe("parseApiError", () => {
  it("reads axios-style errors", () => {
    const error = { response: { data: { code: "X", message: "boom" } } }
    expect(parseApiError(error)).toEqual({ code: "X", message: "boom" })
  })

  it("reads fetch-style errors", () => {
    expect(parseApiError({ data: { code: "Y" } })).toEqual({
      code: "Y",
      message: undefined,
    })
  })

  it("returns an empty object for non-objects", () => {
    expect(parseApiError("nope")).toEqual({})
    expect(parseApiError(null)).toEqual({})
  })
})

describe("resolveErrorMessage", () => {
  const messages = { fallback: "fallback", KNOWN: "known" }

  it("returns null without an error", () => {
    expect(resolveErrorMessage(null, messages)).toBeNull()
  })

  it("prefers the localized message for a known code", () => {
    expect(
      resolveErrorMessage({ code: "KNOWN", message: "raw" }, messages)
    ).toBe("known")
  })

  it("falls back to the server message, then the fallback", () => {
    expect(
      resolveErrorMessage({ code: "OTHER", message: "raw" }, messages)
    ).toBe("raw")
    expect(resolveErrorMessage({}, messages)).toBe("fallback")
  })
})

describe("unwrap", () => {
  it("unwraps a body returned directly", () => {
    expect(unwrap<{ id: number }>({ success: true, data: { id: 1 } })).toEqual({
      id: 1,
    })
  })

  it("unwraps a { data, status } mutator result", () => {
    const res = { status: 200, data: { success: true, data: { id: 2 } } }
    expect(unwrap<{ id: number }>(res)).toEqual({ id: 2 })
  })

  it("throws on an unexpected shape", () => {
    expect(() => unwrap("nope")).toThrow()
  })
})

describe("fill", () => {
  it("replaces known placeholders and keeps unknown ones", () => {
    expect(fill("Hi {name}, {x}", { name: "Ada" })).toBe("Hi Ada, {x}")
  })
})
