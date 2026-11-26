import { describe, expect, it } from "vitest"
import { toQueryBoolean } from "./query-boolean"

describe("toQueryBoolean", () => {
  it("maps booleans to the string flags and keeps undefined absent", () => {
    expect(toQueryBoolean(true)).toBe("true")
    expect(toQueryBoolean(false)).toBe("false")
    expect(toQueryBoolean(undefined)).toBeUndefined()
  })
})
