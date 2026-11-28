import { describe, expect, it } from "vitest"
import { ENTITLEMENT_KINDS } from "./index.js"

describe("entitlement kinds", () => {
  it("lists module, feature and limit", () => {
    expect(ENTITLEMENT_KINDS).toEqual(["module", "feature", "limit"])
  })
})
