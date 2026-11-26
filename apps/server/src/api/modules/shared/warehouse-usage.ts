import type { Tx } from "@avuny/db"

/**
 * What other modules (inventory, purchasing, sales, transfers) know about warehouses and
 * locations. The warehouse modules never read tables they do not own: each module registers a
 * provider and the registry unions the answers. With no providers registered nothing is ever
 * "in use", which is correct until those modules exist.
 */
export interface LocationUsage {
  /** Location ids holding a non-zero stock balance. */
  withStock: string[]
  /** Location ids referenced by an open document (e.g. a purchase order awaiting receipt). */
  withOpenDocuments: string[]
  /** Location ids ever referenced by stock history or documents (blocks hard delete). */
  withHistory: string[]
}

export interface WarehouseUsage {
  hasStock: boolean
  hasOpenDocuments: boolean
  /** Referenced by anything at all: history, documents, per-warehouse item settings... */
  isReferenced: boolean
}

export interface WarehouseUsageProvider {
  name: string
  locationUsage(orgId: string, locationIds: string[], tx?: Tx): Promise<LocationUsage>
  warehouseUsage(orgId: string, warehouseId: string, tx?: Tx): Promise<WarehouseUsage>
}

export interface WarehouseUsageRegistry {
  register(provider: WarehouseUsageProvider): void
  locationUsage(orgId: string, locationIds: string[], tx?: Tx): Promise<LocationUsage>
  warehouseUsage(orgId: string, warehouseId: string, tx?: Tx): Promise<WarehouseUsage>
}

const uniq = (ids: string[]) => [...new Set(ids)]

export function createWarehouseUsageRegistry(): WarehouseUsageRegistry {
  const providers: WarehouseUsageProvider[] = []
  return {
    register(provider) {
      // Registering the same provider twice (hot reload, tests) must not double count.
      if (!providers.some((p) => p.name === provider.name)) providers.push(provider)
    },
    async locationUsage(orgId, locationIds, tx) {
      if (locationIds.length === 0) return { withStock: [], withOpenDocuments: [], withHistory: [] }
      const parts = await Promise.all(providers.map((p) => p.locationUsage(orgId, locationIds, tx)))
      return {
        withStock: uniq(parts.flatMap((p) => p.withStock)),
        withOpenDocuments: uniq(parts.flatMap((p) => p.withOpenDocuments)),
        withHistory: uniq(parts.flatMap((p) => p.withHistory)),
      }
    },
    async warehouseUsage(orgId, warehouseId, tx) {
      const parts = await Promise.all(providers.map((p) => p.warehouseUsage(orgId, warehouseId, tx)))
      return {
        hasStock: parts.some((p) => p.hasStock),
        hasOpenDocuments: parts.some((p) => p.hasOpenDocuments),
        isReferenced: parts.some((p) => p.isReferenced),
      }
    },
  }
}

/** The one shared registry. Other modules call `warehouseUsageRegistry.register(...)` at startup. */
export const warehouseUsageRegistry = createWarehouseUsageRegistry()
