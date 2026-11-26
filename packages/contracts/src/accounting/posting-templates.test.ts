import { describe, expect, it } from "vitest"
import { ACCOUNT_MAPPING_KEYS, ACCOUNTING_SOURCE_TYPES } from "./constants.js"
import { AccountingErrorCode as Err } from "./errors.js"
import {
  buildInventoryOpeningTemplate,
  buildPostingTemplate,
  type PostingTemplate,
  type PostingTemplateLine,
} from "./posting-templates.js"
import { PostBusinessEventSchema, type PostBusinessEventInput } from "./schemas.js"

const sourceId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01"
const base = { sourceId, date: "2026-11-14" }

/** Parses through the real schema so the tests use exactly what the service receives. */
const event = (input: Record<string, unknown>): PostBusinessEventInput =>
  PostBusinessEventSchema.parse({ ...base, ...input })

const template = (input: Record<string, unknown>): PostingTemplate => {
  const result = buildPostingTemplate(event(input))
  if (!result.ok) throw new Error(result.msg)
  return result.template
}

const sum = (lines: PostingTemplateLine[], side: "debit" | "credit") =>
  lines.filter((l) => l.side === side).reduce((acc, l) => acc + l.amount, 0n)

const shape = (lines: PostingTemplateLine[]) =>
  lines.map((l) => `${l.side === "debit" ? "Dr" : "Cr"} ${l.mappingKey} ${l.amount}`)

describe("inventory opening template", () => {
  it("debits inventory and credits opening balance equity", () => {
    expect(shape(buildInventoryOpeningTemplate(500000n))).toEqual([
      "Dr INVENTORY_ASSET 500000",
      "Cr OPENING_BALANCE_EQUITY 500000",
    ])
  })
})

describe("purchasing", () => {
  it("goods receipt: Dr Inventory, Cr GRNI", () => {
    const t = template({ event: "goods_receipt", goodsMinor: "100000" })
    expect(t.sourceType).toBe(ACCOUNTING_SOURCE_TYPES.GOODS_RECEIPT)
    expect(shape(t.lines)).toEqual(["Dr INVENTORY_ASSET 100000", "Cr GOODS_RECEIVED_NOT_INVOICED 100000"])
  })

  it("supplier invoice at the received value posts no variance", () => {
    const t = template({
      event: "supplier_invoice",
      receivedGoodsMinor: "100000",
      invoicedGoodsMinor: "100000",
      taxMinor: "14000",
    })
    expect(shape(t.lines)).toEqual([
      "Dr GOODS_RECEIVED_NOT_INVOICED 100000",
      "Dr INPUT_TAX 14000",
      "Cr ACCOUNTS_PAYABLE 114000",
    ])
  })

  it("supplier invoice above the receipt debits purchase price variance", () => {
    const t = template({
      event: "supplier_invoice",
      receivedGoodsMinor: "100000",
      invoicedGoodsMinor: "103000",
    })
    expect(shape(t.lines)).toEqual([
      "Dr GOODS_RECEIVED_NOT_INVOICED 100000",
      "Dr PURCHASE_PRICE_VARIANCE 3000",
      "Cr ACCOUNTS_PAYABLE 103000",
    ])
  })

  it("supplier invoice below the receipt credits purchase price variance", () => {
    const t = template({
      event: "supplier_invoice",
      receivedGoodsMinor: "100000",
      invoicedGoodsMinor: "97000",
    })
    expect(shape(t.lines)).toEqual([
      "Dr GOODS_RECEIVED_NOT_INVOICED 100000",
      "Cr PURCHASE_PRICE_VARIANCE 3000",
      "Cr ACCOUNTS_PAYABLE 97000",
    ])
  })

  it("purchase invoice: Dr Inventory, Dr Input Tax, Cr Accounts Payable", () => {
    const t = template({ event: "purchase_invoice", goodsMinor: "200000", taxMinor: "28000" })
    expect(shape(t.lines)).toEqual([
      "Dr INVENTORY_ASSET 200000",
      "Dr INPUT_TAX 28000",
      "Cr ACCOUNTS_PAYABLE 228000",
    ])
  })

  it("supplier return reverses inventory and input tax against payables", () => {
    const t = template({ event: "supplier_return", goodsMinor: "50000", taxMinor: "7000" })
    expect(shape(t.lines)).toEqual([
      "Dr ACCOUNTS_PAYABLE 57000",
      "Cr INVENTORY_ASSET 50000",
      "Cr INPUT_TAX 7000",
    ])
  })

  it("landed cost is capitalized or expensed", () => {
    expect(shape(template({ event: "landed_cost", amountMinor: "9000", capitalize: true }).lines)).toEqual([
      "Dr INVENTORY_ASSET 9000",
      "Cr ACCOUNTS_PAYABLE 9000",
    ])
    expect(shape(template({ event: "landed_cost", amountMinor: "9000", capitalize: false }).lines)).toEqual([
      "Dr DELIVERY_EXPENSE 9000",
      "Cr ACCOUNTS_PAYABLE 9000",
    ])
  })
})

describe("sales", () => {
  it("credit sale with tax and discount", () => {
    const t = template({
      event: "sale_revenue",
      grossRevenueMinor: "100000",
      discountMinor: "10000",
      taxMinor: "12600",
      settlement: "receivable",
    })
    expect(shape(t.lines)).toEqual([
      "Dr ACCOUNTS_RECEIVABLE 102600",
      "Dr SALES_DISCOUNTS 10000",
      "Cr SALES_REVENUE 100000",
      "Cr OUTPUT_TAX 12600",
    ])
  })

  it("settles straight into cash or bank", () => {
    const cash = template({ event: "sale_revenue", grossRevenueMinor: "500", settlement: "cash" })
    const bank = template({ event: "sale_revenue", grossRevenueMinor: "500", settlement: "bank" })
    expect(shape(cash.lines)).toEqual(["Dr CASH 500", "Cr SALES_REVENUE 500"])
    expect(shape(bank.lines)).toEqual(["Dr BANK 500", "Cr SALES_REVENUE 500"])
  })

  it("refuses a discount larger than the gross revenue", () => {
    const result = buildPostingTemplate(
      event({
        event: "sale_revenue",
        grossRevenueMinor: "1000",
        discountMinor: "1001",
        settlement: "cash",
      })
    )
    expect(result).toMatchObject({ ok: false, error: Err.ACCOUNTING_INVALID_AMOUNT })
  })

  it("cost of goods sold: Dr COGS, Cr Inventory", () => {
    expect(shape(template({ event: "sale_cost", costMinor: "60000" }).lines)).toEqual([
      "Dr COST_OF_GOODS_SOLD 60000",
      "Cr INVENTORY_ASSET 60000",
    ])
  })

  it("sales return revenue side", () => {
    const t = template({ event: "sale_return_revenue", netMinor: "20000", taxMinor: "2800", settlement: "cash" })
    expect(shape(t.lines)).toEqual(["Dr SALES_RETURNS 20000", "Dr OUTPUT_TAX 2800", "Cr CASH 22800"])
  })

  it("sales return stock side: restock vs write-off", () => {
    expect(shape(template({ event: "sale_return_inventory", costMinor: "12000", condition: "restock" }).lines)).toEqual([
      "Dr INVENTORY_ASSET 12000",
      "Cr COST_OF_GOODS_SOLD 12000",
    ])
    expect(shape(template({ event: "sale_return_inventory", costMinor: "12000", condition: "write_off" }).lines)).toEqual([
      "Dr INVENTORY_WRITE_OFF 12000",
      "Cr COST_OF_GOODS_SOLD 12000",
    ])
  })
})

describe("inventory adjustments", () => {
  it.each([
    ["shortage", "Dr INVENTORY_SHRINKAGE 7000", "Cr INVENTORY_ASSET 7000"],
    ["damage", "Dr INVENTORY_WRITE_OFF 7000", "Cr INVENTORY_ASSET 7000"],
    ["value_decrease", "Dr INVENTORY_VALUATION_ADJUSTMENT 7000", "Cr INVENTORY_ASSET 7000"],
    ["value_increase", "Dr INVENTORY_ASSET 7000", "Cr INVENTORY_VALUATION_ADJUSTMENT 7000"],
  ])("%s", (kind, debit, credit) => {
    const t = template({ event: "inventory_adjustment", kind, amountMinor: "7000" })
    expect(shape(t.lines)).toEqual([debit, credit])
    expect(t.sourceType).toBe(ACCOUNTING_SOURCE_TYPES.INVENTORY_ADJUSTMENT)
  })
})

describe("payments and advances", () => {
  it("customer payment: Dr Cash/Bank, Cr Receivable", () => {
    expect(shape(template({ event: "customer_payment", amountMinor: "800", method: "cash" }).lines)).toEqual([
      "Dr CASH 800",
      "Cr ACCOUNTS_RECEIVABLE 800",
    ])
    expect(shape(template({ event: "customer_payment", amountMinor: "800", method: "bank" }).lines)).toEqual([
      "Dr BANK 800",
      "Cr ACCOUNTS_RECEIVABLE 800",
    ])
  })

  it("supplier payment: Dr Payable, Cr Cash/Bank", () => {
    expect(shape(template({ event: "supplier_payment", amountMinor: "900", method: "bank" }).lines)).toEqual([
      "Dr ACCOUNTS_PAYABLE 900",
      "Cr BANK 900",
    ])
  })

  it("customer advance: Dr Cash/Bank, Cr Customer Advances", () => {
    expect(shape(template({ event: "customer_advance", amountMinor: "300", method: "cash" }).lines)).toEqual([
      "Dr CASH 300",
      "Cr CUSTOMER_ADVANCES 300",
    ])
  })

  it("supplier advance: Dr Supplier Advances, Cr Cash/Bank", () => {
    expect(shape(template({ event: "supplier_advance", amountMinor: "300", method: "bank" }).lines)).toEqual([
      "Dr SUPPLIER_ADVANCES 300",
      "Cr BANK 300",
    ])
  })
})

describe("every template", () => {
  const events: Record<string, unknown>[] = [
    { event: "goods_receipt", goodsMinor: "100" },
    { event: "supplier_invoice", receivedGoodsMinor: "100", invoicedGoodsMinor: "130", taxMinor: "10" },
    { event: "supplier_invoice", receivedGoodsMinor: "100", invoicedGoodsMinor: "70", taxMinor: "10" },
    { event: "purchase_invoice", goodsMinor: "100", taxMinor: "14" },
    { event: "supplier_return", goodsMinor: "100", taxMinor: "14" },
    { event: "landed_cost", amountMinor: "100", capitalize: true },
    { event: "sale_revenue", grossRevenueMinor: "100", discountMinor: "10", taxMinor: "13", settlement: "receivable" },
    { event: "sale_cost", costMinor: "100" },
    { event: "sale_return_revenue", netMinor: "100", taxMinor: "14", settlement: "bank" },
    { event: "sale_return_inventory", costMinor: "100", condition: "restock" },
    { event: "inventory_adjustment", kind: "shortage", amountMinor: "100" },
    { event: "customer_payment", amountMinor: "100", method: "cash" },
    { event: "supplier_payment", amountMinor: "100", method: "cash" },
    { event: "customer_advance", amountMinor: "100", method: "cash" },
    { event: "supplier_advance", amountMinor: "100", method: "cash" },
  ]

  it.each(events.map((e) => [String(e.event), e] as const))("%s balances and uses real mapping keys", (_name, e) => {
    const t = template(e)
    expect(t.lines.length).toBeGreaterThanOrEqual(2)
    expect(sum(t.lines, "debit")).toBe(sum(t.lines, "credit"))
    for (const l of t.lines) {
      expect(l.amount > 0n).toBe(true)
      expect((ACCOUNT_MAPPING_KEYS as readonly string[]).includes(l.mappingKey)).toBe(true)
    }
  })

  it("covers every event the schema accepts", () => {
    const covered = new Set(events.map((e) => e.event))
    const accepted = PostBusinessEventSchema.options.map((o) => o.shape.event.value)
    for (const name of accepted) expect(covered.has(name)).toBe(true)
  })
})
