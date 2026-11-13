import { describe, expect, it } from "vitest"
import { mapBlanks, parseOptionalNumber } from "./blank-values"

describe("mapBlanks", () => {
  it("replaces blank and whitespace-only strings under the given keys", () => {
    expect(mapBlanks({ a: "", b: "  ", c: "x" }, ["a", "b", "c"], undefined)).toEqual({ a: undefined, b: undefined, c: "x" })
    expect(mapBlanks({ a: "" }, ["a"], null)).toEqual({ a: null })
  })
  it("leaves other keys and non-strings alone", () => {
    expect(mapBlanks({ a: "", b: "", n: 0 }, ["a", "n"], undefined)).toEqual({ a: undefined, b: "", n: 0 })
  })
})

describe("parseOptionalNumber", () => {
  it("returns undefined for blank input and a number otherwise", () => {
    expect(parseOptionalNumber("")).toBeUndefined()
    expect(parseOptionalNumber(" 12 ")).toBe(12)
  })
})
