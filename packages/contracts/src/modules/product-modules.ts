import type { Localized } from "./registry.js"

/**
 * Product modules (SPEC 2.1, 2.4): the units a customer understands and can
 * switch on or off. Each groups one or more registry modules; every registry
 * module names its product module via `ModuleSpec.product` (registry.ts), so
 * the grouping itself is derived (catalog.ts), never maintained twice.
 *
 * `platform` (API access, SSO, branding) is deliberately absent: SPEC 2.4
 * makes it feature-only until something enforces it, and a product module
 * with no registry modules and no planned ones would gate nothing.
 *
 * This file holds only product-level metadata and has no runtime dependency
 * on the registry, which lets registry.ts import the ProductModuleKey type
 * without a cycle.
 */

export const PRODUCT_MODULE_KEYS = [
  "core",
  "inventory",
  "inventory_advanced",
  "inventory_costing",
  "purchasing",
  "sales",
  "accounting",
  "assembly",
] as const

export type ProductModuleKey = (typeof PRODUCT_MODULE_KEYS)[number]

export interface SoftDependency {
  module: ProductModuleKey
  /** Why the coupling exists and what degrades when the module is off. */
  reason: string
}

export interface ProductModuleSpec {
  label: Localized
  /** Product modules that must be entitled for this one to work (SPEC 2.4). */
  dependsOn: readonly ProductModuleKey[]
  /**
   * Soft dependencies (SPEC 2.4, confirmed against the import scan in S1-02):
   * the code calls into these modules but works without them - journal
   * posting is skipped with JOURNAL_NOT_POSTED_MODULE_OFF, batch fields stay
   * inactive, and so on. May point back up the dependsOn chain (soft edges
   * never create hard cycles). */
  softDependsOn?: readonly SoftDependency[]
  /** Can the organization owner switch it off while entitled (SPEC 2.1)? */
  switchable: boolean
  /** On for a new organization unless onboarding says otherwise (Q7). */
  defaultOn: boolean
  /** Show locked in the sidebar with an upgrade prompt (Q9). */
  showLocked: boolean
  /**
   * Registry modules not yet built (future specs). Listed so the catalog
   * documents the intended home; they gate nothing until they exist.
   */
  plannedModules?: readonly string[]
}

export const PRODUCT_MODULES = {
  /** Always on, not switchable: identity, membership, roles, audit. */
  core: {
    label: { en: "Core", ar: "الأساس" },
    dependsOn: [],
    softDependsOn: [
      {
        module: "inventory",
        reason:
          "Creating an organization seeds its default warehouse and inventory settings (organization.service -> warehouse.defaults).",
      },
    ],
    switchable: false,
    defaultOn: true,
    showLocked: false,
  },
  inventory: {
    label: { en: "Inventory", ar: "المخزون" },
    dependsOn: ["core"],
    softDependsOn: [
      {
        module: "accounting",
        reason:
          "Item opening stock and inventory adjustments post journal entries when Accounting is on (JOURNAL_NOT_POSTED_MODULE_OFF when off).",
      },
      {
        module: "inventory_advanced",
        reason:
          "Batch tracking is woven through items and stock movements; batch fields activate for batch-tracked items (feature.batch_tracking).",
      },
      {
        module: "inventory_costing",
        reason:
          "Opening stock and adjustments consult the costing service; full costing unlocks with the module.",
      },
    ],
    switchable: true,
    defaultOn: true, // Q7: Inventory is on by default.
    showLocked: true,
  },
  inventory_advanced: {
    label: { en: "Advanced inventory", ar: "المخزون المتقدم" },
    dependsOn: ["inventory"],
    softDependsOn: [
      {
        module: "inventory_costing",
        reason: "Inventory transfers consult the costing service for valuation.",
      },
    ],
    switchable: true,
    defaultOn: false,
    showLocked: true,
    // inventory_reservation has contracts and schema but no server module yet.
    plannedModules: ["inventory_reservation"],
  },
  inventory_costing: {
    label: { en: "Inventory costing", ar: "تكلفة المخزون" },
    dependsOn: ["inventory"],
    switchable: true,
    defaultOn: false,
    showLocked: true,
    // Spec in PR #55; the registry module lands with the server module.
    plannedModules: ["inventory_costing"],
  },
  purchasing: {
    label: { en: "Purchasing", ar: "المشتريات" },
    dependsOn: ["inventory"],
    softDependsOn: [
      {
        module: "accounting",
        reason:
          "Vendor bills, vendor payments and purchase receipts post journal entries when Accounting is on (SPEC 2.4).",
      },
      {
        module: "inventory_advanced",
        reason: "Purchase receipts create batches for batch-tracked items.",
      },
      {
        module: "inventory_costing",
        reason: "Purchase receipts feed landed cost into the costing service.",
      },
    ],
    switchable: true,
    defaultOn: false,
    showLocked: true,
  },
  sales: {
    label: { en: "Sales", ar: "المبيعات" },
    dependsOn: ["inventory"],
    softDependsOn: [
      {
        module: "accounting",
        reason:
          "Sales orders, deliveries, invoices, credit notes and customer payments post journal entries when Accounting is on (SPEC 2.4).",
      },
      {
        module: "inventory_costing",
        reason: "Sales deliveries value outbound stock through the costing service.",
      },
      {
        module: "inventory_advanced",
        reason:
          "Sales orders and deliveries reserve stock through inventory reservation.",
      },
      {
        module: "purchasing",
        reason:
          "Sales orders reference payment terms, which live in the purchasing product (shared party tables, SPEC 2.4).",
      },
    ],
    switchable: true,
    defaultOn: false,
    showLocked: true,
  },
  accounting: {
    label: { en: "Accounting", ar: "المحاسبة" },
    dependsOn: ["core"],
    switchable: true,
    defaultOn: false,
    showLocked: true,
  },
  assembly: {
    label: { en: "Assembly", ar: "التصنيع" },
    dependsOn: ["inventory_costing"],
    switchable: true,
    defaultOn: false,
    showLocked: true,
    plannedModules: ["assembly", "bill_of_materials"],
  },
} as const satisfies Record<ProductModuleKey, unknown> as Record<
  ProductModuleKey,
  ProductModuleSpec
>
