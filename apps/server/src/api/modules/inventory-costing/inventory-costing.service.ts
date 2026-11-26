import type { InventoryCostLayer, NewInventoryCostAllocation, NewInventoryCostLayer, Tx } from "@avuny/db"
import type { InventoryCostingServiceDeps } from "./inventory-costing.types.js"

/**
 * Input for creating a cost layer from an inbound movement line.
 * Called by the opening stock flow after a movement line has been posted.
 */
export interface CreateCostLayerInput {
  orgId: string
  inventoryItemId: string
  itemId: string
  inventoryItemBatchId: string | null
  sourceMovementLineId: string
  originCostLayerId: string | null
  /** Quantity received. Must be positive (numeric string). */
  receivedQty: string
  /** Monetary value in integer minor units (bigint stored as number). Must be non-negative. */
  receivedValue: number
  currency: string
  receivedAt: Date
}

/**
 * Input for recording a FIFO allocation when stock leaves.
 * The caller must pass the exact qty/value consumed from each layer.
 */
export interface RecordAllocationInput {
  orgId: string
  outgoingMovementLineId: string
  costLayerId: string
  allocatedQty: string
  /** Monetary value in integer minor units (bigint stored as number). */
  allocatedValue: number
}

export function createInventoryCostingService(deps: InventoryCostingServiceDeps) {
  const repo = deps.repository

  return {
    /**
     * Creates a cost layer for an inbound movement line.
     * Sets receivedQty = remainingQty and receivedValue = remainingValue (layer starts full).
     */
    async createCostLayer(input: CreateCostLayerInput, tx?: Tx): Promise<InventoryCostLayer> {
      const values: NewInventoryCostLayer = {
        orgId: input.orgId,
        inventoryItemId: input.inventoryItemId,
        itemId: input.itemId,
        inventoryItemBatchId: input.inventoryItemBatchId ?? undefined,
        sourceMovementLineId: input.sourceMovementLineId,
        originCostLayerId: input.originCostLayerId ?? undefined,
        receivedQty: input.receivedQty,
        remainingQty: input.receivedQty,
        receivedValue: input.receivedValue,
        remainingValue: input.receivedValue,
        currency: input.currency,
        receivedAt: input.receivedAt,
      }
      return repo.insertCostLayer(values, tx)
    },

    /**
     * Records that an outgoing movement line consumed qty/value from a cost layer,
     * and depletes the layer accordingly.
     */
    async recordAllocation(input: RecordAllocationInput, tx?: Tx): Promise<void> {
      const valueStr = String(input.allocatedValue)
      await repo.insertCostAllocation(
        {
          orgId: input.orgId,
          outgoingMovementLineId: input.outgoingMovementLineId,
          costLayerId: input.costLayerId,
          allocatedQty: input.allocatedQty,
          allocatedValue: input.allocatedValue,
        } satisfies NewInventoryCostAllocation,
        tx
      )
      await repo.depleteCostLayer(
        input.orgId,
        input.costLayerId,
        input.allocatedQty,
        valueStr,
        tx
      )
    },

    /**
     * Returns all FIFO-ordered cost layers for one inventory item (optionally one batch).
     * Used by the opening stock flow to verify layers were created.
     * forUpdate = true in a write transaction.
     */
    async getFifoLayers(
      orgId: string,
      inventoryItemId: string,
      inventoryItemBatchId: string | null,
      opts: { forUpdate?: boolean },
      tx?: Tx
    ): Promise<InventoryCostLayer[]> {
      return repo.findFifoLayers(orgId, inventoryItemId, inventoryItemBatchId, opts, tx)
    },

    /**
     * Returns the cost layers created by one specific movement line.
     * Used by the opening stock integration to look up what was created.
     */
    async getLayersBySourceLine(
      orgId: string,
      sourceMovementLineId: string,
      tx?: Tx
    ): Promise<InventoryCostLayer[]> {
      return repo.findLayersBySourceLine(orgId, sourceMovementLineId, tx)
    },
  }
}
