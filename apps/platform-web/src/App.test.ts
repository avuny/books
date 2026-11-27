import { describe, expect, it } from "vitest"

import { resources } from "@/i18n/resources"

describe("platform web", () => {
  it("has the common namespace in English", () => {
    expect(resources.en.common.app.name).toBe("Avuny Platform")
  })
})
