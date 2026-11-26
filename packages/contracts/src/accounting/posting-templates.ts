import {
  ACCOUNTING_SOURCE_TYPES,
  type AccountMappingKey,
  type AccountingSourceType,
} from "./constants.js"
import { AccountingErrorCode } from "./errors.js"
import { parseMinorAmount } from "./rules.js"
import type { PostBusinessEventInput } from "./schemas.js"

/**
 * How each business event hits the books. A template names mapping KEYS, never accounts: the service
 * resolves each key to the organization's mapped account, then runs the ordinary journal checks.
 * Pure and exhaustive over PostBusinessEventInput (the compiler flags a new event without a template).
 */

export interface PostingTemplateLine {
  mappingKey: AccountMappingKey
  side: "debit" | "credit"
  amount: bigint
}

export interface PostingTemplate {
  sourceType: AccountingSourceType
  description: string
  lines: PostingTemplateLine[]
}

export type PostingTemplateResult =
  | { ok: true; template: PostingTemplate }
  | { ok: false; error: typeof AccountingErrorCode.ACCOUNTING_INVALID_AMOUNT; msg: string }

const cashOrBank = (method: "cash" | "bank"): AccountMappingKey => (method === "cash" ? "CASH" : "BANK")

const settlementKey = (s: "receivable" | "cash" | "bank"): AccountMappingKey =>
  s === "receivable" ? "ACCOUNTS_RECEIVABLE" : s === "cash" ? "CASH" : "BANK"

const dr = (mappingKey: AccountMappingKey, amount: bigint): PostingTemplateLine => ({
  mappingKey,
  side: "debit",
  amount,
})
const cr = (mappingKey: AccountMappingKey, amount: bigint): PostingTemplateLine => ({
  mappingKey,
  side: "credit",
  amount,
})

/** Dr Inventory, Cr Opening Balance Equity: opening stock is a starting position, not a purchase or a sale. */
export function buildInventoryOpeningTemplate(amount: bigint): PostingTemplateLine[] {
  return [dr("INVENTORY_ASSET", amount), cr("OPENING_BALANCE_EQUITY", amount)]
}

export function buildPostingTemplate(event: PostBusinessEventInput): PostingTemplateResult {
  const invalid = (msg: string): PostingTemplateResult => ({
    ok: false,
    error: AccountingErrorCode.ACCOUNTING_INVALID_AMOUNT,
    msg,
  })
  const amt = (value: string): bigint | null => parseMinorAmount(value)
  const done = (
    sourceType: AccountingSourceType,
    description: string,
    lines: PostingTemplateLine[]
  ): PostingTemplateResult => ({
    ok: true,
    template: { sourceType, description, lines: lines.filter((l) => l.amount > 0n) },
  })

  switch (event.event) {
    case "goods_receipt": {
      const goods = amt(event.goodsMinor)
      if (goods === null) return invalid("Invalid goods amount")
      return done(ACCOUNTING_SOURCE_TYPES.GOODS_RECEIPT, "Goods receipt", [
        dr("INVENTORY_ASSET", goods),
        cr("GOODS_RECEIVED_NOT_INVOICED", goods),
      ])
    }

    case "supplier_invoice": {
      const received = amt(event.receivedGoodsMinor)
      const invoiced = amt(event.invoicedGoodsMinor)
      const tax = amt(event.taxMinor)
      if (received === null || invoiced === null || tax === null) return invalid("Invalid invoice amount")
      const variance = invoiced - received
      return done(ACCOUNTING_SOURCE_TYPES.SUPPLIER_INVOICE, "Supplier invoice", [
        dr("GOODS_RECEIVED_NOT_INVOICED", received),
        dr("PURCHASE_PRICE_VARIANCE", variance > 0n ? variance : 0n),
        cr("PURCHASE_PRICE_VARIANCE", variance < 0n ? -variance : 0n),
        dr("INPUT_TAX", tax),
        cr("ACCOUNTS_PAYABLE", invoiced + tax),
      ])
    }

    case "purchase_invoice": {
      const goods = amt(event.goodsMinor)
      const tax = amt(event.taxMinor)
      if (goods === null || tax === null) return invalid("Invalid purchase amount")
      return done(ACCOUNTING_SOURCE_TYPES.PURCHASE_INVOICE, "Purchase invoice", [
        dr("INVENTORY_ASSET", goods),
        dr("INPUT_TAX", tax),
        cr("ACCOUNTS_PAYABLE", goods + tax),
      ])
    }

    case "supplier_return": {
      const goods = amt(event.goodsMinor)
      const tax = amt(event.taxMinor)
      if (goods === null || tax === null) return invalid("Invalid return amount")
      return done(ACCOUNTING_SOURCE_TYPES.SUPPLIER_RETURN, "Supplier return", [
        dr("ACCOUNTS_PAYABLE", goods + tax),
        cr("INVENTORY_ASSET", goods),
        cr("INPUT_TAX", tax),
      ])
    }

    case "landed_cost": {
      const cost = amt(event.amountMinor)
      if (cost === null) return invalid("Invalid cost amount")
      return done(ACCOUNTING_SOURCE_TYPES.LANDED_COST, "Landed cost", [
        dr(event.capitalize ? "INVENTORY_ASSET" : "DELIVERY_EXPENSE", cost),
        cr("ACCOUNTS_PAYABLE", cost),
      ])
    }

    case "sale_revenue": {
      const gross = amt(event.grossRevenueMinor)
      const discount = amt(event.discountMinor)
      const tax = amt(event.taxMinor)
      if (gross === null || discount === null || tax === null) return invalid("Invalid sale amount")
      if (discount > gross) return invalid("The discount cannot exceed the gross revenue")
      return done(ACCOUNTING_SOURCE_TYPES.SALE_REVENUE, "Sale", [
        dr(settlementKey(event.settlement), gross - discount + tax),
        dr("SALES_DISCOUNTS", discount),
        cr("SALES_REVENUE", gross),
        cr("OUTPUT_TAX", tax),
      ])
    }

    case "sale_cost": {
      const cost = amt(event.costMinor)
      if (cost === null) return invalid("Invalid cost amount")
      return done(ACCOUNTING_SOURCE_TYPES.SALE_COST, "Cost of goods sold", [
        dr("COST_OF_GOODS_SOLD", cost),
        cr("INVENTORY_ASSET", cost),
      ])
    }

    case "sale_return_revenue": {
      const net = amt(event.netMinor)
      const tax = amt(event.taxMinor)
      if (net === null || tax === null) return invalid("Invalid return amount")
      return done(ACCOUNTING_SOURCE_TYPES.SALE_RETURN_REVENUE, "Sales return", [
        dr("SALES_RETURNS", net),
        dr("OUTPUT_TAX", tax),
        cr(settlementKey(event.settlement), net + tax),
      ])
    }

    case "sale_return_inventory": {
      const cost = amt(event.costMinor)
      if (cost === null) return invalid("Invalid cost amount")
      return done(ACCOUNTING_SOURCE_TYPES.SALE_RETURN_INVENTORY, "Returned goods", [
        dr(event.condition === "restock" ? "INVENTORY_ASSET" : "INVENTORY_WRITE_OFF", cost),
        cr("COST_OF_GOODS_SOLD", cost),
      ])
    }

    case "inventory_adjustment": {
      const value = amt(event.amountMinor)
      if (value === null) return invalid("Invalid adjustment amount")
      const lines: Record<typeof event.kind, PostingTemplateLine[]> = {
        shortage: [dr("INVENTORY_SHRINKAGE", value), cr("INVENTORY_ASSET", value)],
        damage: [dr("INVENTORY_WRITE_OFF", value), cr("INVENTORY_ASSET", value)],
        value_decrease: [dr("INVENTORY_VALUATION_ADJUSTMENT", value), cr("INVENTORY_ASSET", value)],
        value_increase: [dr("INVENTORY_ASSET", value), cr("INVENTORY_VALUATION_ADJUSTMENT", value)],
      }
      return done(ACCOUNTING_SOURCE_TYPES.INVENTORY_ADJUSTMENT, "Inventory adjustment", lines[event.kind])
    }

    case "customer_payment": {
      const paid = amt(event.amountMinor)
      if (paid === null) return invalid("Invalid payment amount")
      return done(ACCOUNTING_SOURCE_TYPES.CUSTOMER_PAYMENT, "Customer payment", [
        dr(cashOrBank(event.method), paid),
        cr("ACCOUNTS_RECEIVABLE", paid),
      ])
    }

    case "supplier_payment": {
      const paid = amt(event.amountMinor)
      if (paid === null) return invalid("Invalid payment amount")
      return done(ACCOUNTING_SOURCE_TYPES.SUPPLIER_PAYMENT, "Supplier payment", [
        dr("ACCOUNTS_PAYABLE", paid),
        cr(cashOrBank(event.method), paid),
      ])
    }

    case "customer_advance": {
      const paid = amt(event.amountMinor)
      if (paid === null) return invalid("Invalid advance amount")
      return done(ACCOUNTING_SOURCE_TYPES.CUSTOMER_ADVANCE, "Customer advance", [
        dr(cashOrBank(event.method), paid),
        cr("CUSTOMER_ADVANCES", paid),
      ])
    }

    case "supplier_advance": {
      const paid = amt(event.amountMinor)
      if (paid === null) return invalid("Invalid advance amount")
      return done(ACCOUNTING_SOURCE_TYPES.SUPPLIER_ADVANCE, "Supplier advance", [
        dr("SUPPLIER_ADVANCES", paid),
        cr(cashOrBank(event.method), paid),
      ])
    }
  }
}
