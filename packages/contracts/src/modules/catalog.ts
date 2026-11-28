import { MODULES } from "./registry.js"
import type { ModuleKey } from "./derive.js"
import {
  PRODUCT_MODULES,
  type ProductModuleKey,
  type ProductModuleSpec,
} from "./product-modules.js"

/**
 * MODULE_CATALOG (SPEC 2.2, 2.4; S1-01): the code-level truth of what exists
 * commercially. Derived from the registry by scanning each module's `product`
 * key, so a registry module can never land without a product home and the
 * grouping can never drift from the registry.
 *
 * The commercial layer (plans, entitlements) may only reference these keys.
 */

export interface CatalogEntry extends ProductModuleSpec {
  /** Registry modules grouped under this product module, in registry order. */
  modules: ModuleKey[]
}

const deriveCatalog = (): Record<ProductModuleKey, CatalogEntry> => {
  const catalog = Object.fromEntries(
    Object.entries(PRODUCT_MODULES).map(([key, spec]) => [
      key,
      { ...spec, dependsOn: [...spec.dependsOn], modules: [] as ModuleKey[] },
    ])
  ) as unknown as Record<ProductModuleKey, CatalogEntry>

  for (const [moduleKey, spec] of Object.entries(MODULES)) {
    const product = catalog[spec.product]
    if (!product) {
      throw new Error(
        `Registry module "${moduleKey}" names unknown product module "${spec.product}"`
      )
    }
    product.modules.push(moduleKey as ModuleKey)
  }
  return catalog
}

export const MODULE_CATALOG: Record<ProductModuleKey, CatalogEntry> =
  deriveCatalog()
