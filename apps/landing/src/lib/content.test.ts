import { describe, expect, it, vi } from "vitest"

import { parseSnapshot } from "./content"
import fixture from "@/content/fixture.en.json"

describe("parseSnapshot", () => {
  it("accepts the sample fixture", () => {
    expect(parseSnapshot(fixture).blocks.length).toBeGreaterThan(0)
  })
  it("skips unknown block types with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const s = parseSnapshot({ ...fixture, blocks: [{ type: "future_block" }] })
    expect(s.blocks).toHaveLength(0)
    expect(warn).toHaveBeenCalled()
  })
  it("fails on a bad snapshot", () => {
    expect(() => parseSnapshot({ ...fixture, schemaVersion: 2 })).toThrow()
    expect(() => parseSnapshot({ ...fixture, blocks: [{ type: "hero" }] })).toThrow()
  })
})
