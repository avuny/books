import { describe, expect, it } from "vitest"
import {
  CreateInventoryTransferSchema,
  InventoryTransferStatusSchema,
  ReceiveInventoryTransferSchema,
  SettleInventoryTransferSchema,
  UpdateInventoryTransferSchema,
} from "./schemas.js"
import { INVENTORY_TRANSFER_NUMBER_REGEX, INVENTORY_TRANSFER_STATUSES } from "./constants.js"

const uuid = (n: number) => `a0000000-0000-4000-a000-${String(n).padStart(12, "0")}`

const line = {
  itemId: uuid(1),
  sourceLocationId: uuid(2),
  destinationLocationId: uuid(3),
  unitId: uuid(4),
  quantity: "5",
}

describe("inventory-transfer contracts schemas", () => {
  it("validates every status and rejects unknown ones", () => {
    for (const s of INVENTORY_TRANSFER_STATUSES) {
      expect(InventoryTransferStatusSchema.parse(s)).toBe(s)
    }
    expect(() => InventoryTransferStatusSchema.parse("UNKNOWN")).toThrow()
  })

  it("matches transfer numbers", () => {
    expect(INVENTORY_TRANSFER_NUMBER_REGEX.test("TRF-000001")).toBe(true)
    expect(INVENTORY_TRANSFER_NUMBER_REGEX.test("TRF-1")).toBe(false)
  })

  it("accepts a valid create payload", () => {
    const parsed = CreateInventoryTransferSchema.parse({
      date: "2026-11-26",
      sourceWarehouseId: uuid(10),
      destinationWarehouseId: uuid(11),
      lines: [line],
    })
    expect(parsed.lines).toHaveLength(1)
  })

  it("rejects create without lines, with a bad date or a bad quantity", () => {
    const base = { date: "2026-11-26", sourceWarehouseId: uuid(10), destinationWarehouseId: uuid(11) }
    expect(() => CreateInventoryTransferSchema.parse({ ...base, lines: [] })).toThrow()
    expect(() => CreateInventoryTransferSchema.parse({ ...base, date: "26/11/2026", lines: [line] })).toThrow()
    expect(() =>
      CreateInventoryTransferSchema.parse({ ...base, lines: [{ ...line, quantity: "abc" }] }),
    ).toThrow()
  })

  it("requires at least one field on update", () => {
    expect(() => UpdateInventoryTransferSchema.parse({})).toThrow()
    expect(UpdateInventoryTransferSchema.parse({ date: "2026-11-27" }).date).toBe("2026-11-27")
  })

  it("requires lines on receive and allows an empty settle body", () => {
    expect(() => ReceiveInventoryTransferSchema.parse({ lines: [] })).toThrow()
    expect(
      ReceiveInventoryTransferSchema.parse({ lines: [{ allocationId: uuid(20), baseQuantity: "2" }] }).lines,
    ).toHaveLength(1)
    expect(SettleInventoryTransferSchema.parse({})).toEqual({})
  })
})
