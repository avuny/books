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

export interface ProductModuleSpec {
  label: Localized
  /** Product modules that must be entitled for this one to work (SPEC 2.4). */
  dependsOn: readonly ProductModuleKey[]
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
    switchable: false,
    defaultOn: true,
    showLocked: false,
  },
  inventory: {
    label: { en: "Inventory", ar: "المخزون" },
    dependsOn: ["core"],
    switchable: true,
    defaultOn: true, // Q7: Inventory is on by default.
    showLocked: true,
  },
  inventory_advanced: {
    label: { en: "Advanced inventory", ar: "المخزون المتقدم" },
    dependsOn: ["inventory"],
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
    switchable: true,
    defaultOn: false,
    showLocked: true,
  },
  sales: {
    label: { en: "Sales", ar: "المبيعات" },
    dependsOn: ["inventory"],
    switchable: true,
    defaultOn: false,
    showLocked: true,
    // Only customers exist today; future sales documents register here.
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
