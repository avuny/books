import { describe, expect, it } from "vitest"
import {
  findPrimaryIndex,
  setPrimaryIndex,
  ensurePrimaryOnAdd,
  ensurePrimaryOnRemove,
} from "./contact-primary.js"

describe("contact-primary (WT-PRIMARY)", () => {
  it("findPrimaryIndex finds the primary item or -1", () => {
    expect(findPrimaryIndex([])).toBe(-1)
    expect(findPrimaryIndex([{ isPrimary: false }, { isPrimary: true }])).toBe(1)
    expect(findPrimaryIndex([{ isPrimary: false }, { isPrimary: false }])).toBe(-1)
  })

  it("setPrimaryIndex makes only the target index primary", () => {
    const items = [{ isPrimary: true }, { isPrimary: false }, { isPrimary: false }]
    const updated = setPrimaryIndex(items, 2)
    expect(updated[0]?.isPrimary).toBe(false)
    expect(updated[1]?.isPrimary).toBe(false)
    expect(updated[2]?.isPrimary).toBe(true)
  })

  it("ensurePrimaryOnAdd makes first item primary if none was primary", () => {
    const items = [{ isPrimary: false }]
    const updated = ensurePrimaryOnAdd(items)
    expect(updated[0]?.isPrimary).toBe(true)
  })

  it("ensurePrimaryOnRemove promotes the first remaining item when primary is removed", () => {
    const items = [
      { id: "1", isPrimary: true },
      { id: "2", isPrimary: false },
      { id: "3", isPrimary: false },
    ]
    const updated = ensurePrimaryOnRemove(items, 0)
    expect(updated).toHaveLength(2)
    expect(updated[0]?.id).toBe("2")
    expect(updated[0]?.isPrimary).toBe(true)
    expect(updated[1]?.isPrimary).toBe(false)
  })

  it("ensurePrimaryOnRemove keeps the existing primary when a non-primary item is removed", () => {
    const items = [
      { id: "1", isPrimary: true },
      { id: "2", isPrimary: false },
    ]
    const updated = ensurePrimaryOnRemove(items, 1)
    expect(updated).toHaveLength(1)
    expect(updated[0]?.id).toBe("1")
    expect(updated[0]?.isPrimary).toBe(true)
  })
})
