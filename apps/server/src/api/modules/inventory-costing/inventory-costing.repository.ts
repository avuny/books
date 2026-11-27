import { and, asc, eq, gt, sql } from "drizzle-orm"
import {
  inventoryCostAllocations,
  inventoryCostLayers,
  type DB,
  type InventoryCostAllocation,
  type InventoryCostLayer,
  type NewInventoryCostAllocation,
  type NewInventoryCostLayer,
  type Tx,
} from "@avuny/db"

export function createInventoryCostingRepository({ db }: { db: DB }) {
  const exec = (tx?: Tx): DB | Tx => tx ?? db

  return {
    // ---- cost layer writes ----

    /** Insert a new cost layer (from an inbound movement line). */
    async insertCostLayer(values: NewInventoryCostLayer, tx?: Tx): Promise<InventoryCostLayer> {
      const [row] = await exec(tx).insert(inventoryCostLayers).values(values).returning()
      if (!row) throw new Error("Failed to insert cost layer")
      return row
    },

    /** Consume qty+value from a cost layer (FIFO depletion). */
    async depleteCostLayer(
      orgId: string,
      layerId: string,
      qtyConsumed: string,
      valueConsumed: string,
      tx?: Tx
    ): Promise<void> {
      await exec(tx)
        .update(inventoryCostLayers)
        .set({
          remainingQty: sql`${inventoryCostLayers.remainingQty} - ${qtyConsumed}`,
          remainingValue: sql`${inventoryCostLayers.remainingValue} - ${valueConsumed}`,
          updatedAt: sql`now()`,
        })
        .where(and(eq(inventoryCostLayers.orgId, orgId), eq(inventoryCostLayers.id, layerId)))
    },

    // ---- cost allocation writes ----

    /** Record that an outgoing line consumed some of a cost layer. */
    async insertCostAllocation(
      values: NewInventoryCostAllocation,
      tx?: Tx
    ): Promise<InventoryCostAllocation> {
      const [row] = await exec(tx).insert(inventoryCostAllocations).values(values).returning()
      if (!row) throw new Error("Failed to insert cost allocation")
      return row
    },

    // ---- cost layer reads ----

    /**
     * Fetch FIFO layers for one inventory item (optionally one batch),
     * ordered by receivedAt ASC, id ASC, that still have remainingQty > 0.
     * Lock for update when tx is provided and forUpdate is true.
     */
    async findFifoLayers(
      orgId: string,
      inventoryItemId: string,
      inventoryItemBatchId: string | null,
      opts: { forUpdate?: boolean },
      tx?: Tx
    ): Promise<InventoryCostLayer[]> {
      const executor = exec(tx)
      const conditions = [
        eq(inventoryCostLayers.orgId, orgId),
        eq(inventoryCostLayers.inventoryItemId, inventoryItemId),
        gt(inventoryCostLayers.remainingQty, "0"),
      ]
      if (inventoryItemBatchId !== null) {
        conditions.push(eq(inventoryCostLayers.inventoryItemBatchId, inventoryItemBatchId))
      }
      const query = executor
        .select()
        .from(inventoryCostLayers)
        .where(and(...conditions))
        .orderBy(asc(inventoryCostLayers.receivedAt), asc(inventoryCostLayers.id))

      if (opts.forUpdate && tx) {
        return (query as any).for("update") as Promise<InventoryCostLayer[]>
      }
      return query
    },

    /**
     * Find the cost layers created by one source movement line.
     */
    async findLayersBySourceLine(
      orgId: string,
      sourceMovementLineId: string,
      tx?: Tx
    ): Promise<InventoryCostLayer[]> {
      return exec(tx)
        .select()
        .from(inventoryCostLayers)
        .where(
          and(
            eq(inventoryCostLayers.orgId, orgId),
            eq(inventoryCostLayers.sourceMovementLineId, sourceMovementLineId)
          )
        )
    },

    /** Layers created by one movement line that still hold quantity, FIFO order, locked. */
    async findOpenLayersBySourceLine(orgId: string, sourceMovementLineId: string, tx: Tx): Promise<InventoryCostLayer[]> {
      return tx
        .select()
        .from(inventoryCostLayers)
        .where(
          and(
            eq(inventoryCostLayers.orgId, orgId),
            eq(inventoryCostLayers.sourceMovementLineId, sourceMovementLineId),
            gt(inventoryCostLayers.remainingQty, "0")
          )
        )
        .orderBy(asc(inventoryCostLayers.receivedAt), asc(inventoryCostLayers.id))
        .for("update")
    },

    async findAllocationsByOutgoingLine(orgId: string, outgoingMovementLineId: string, tx: Tx): Promise<InventoryCostAllocation[]> {
      return tx
        .select()
        .from(inventoryCostAllocations)
        .where(
          and(
            eq(inventoryCostAllocations.orgId, orgId),
            eq(inventoryCostAllocations.outgoingMovementLineId, outgoingMovementLineId)
          )
        )
    },

    /** Gives quantity and value back to a layer (undo of a depletion). */
    async restoreCostLayer(orgId: string, layerId: string, qty: string, value: string, tx: Tx): Promise<void> {
      await tx
        .update(inventoryCostLayers)
        .set({
          remainingQty: sql`${inventoryCostLayers.remainingQty} + ${qty}`,
          remainingValue: sql`${inventoryCostLayers.remainingValue} + ${value}`,
          updatedAt: sql`now()`,
        })
        .where(and(eq(inventoryCostLayers.orgId, orgId), eq(inventoryCostLayers.id, layerId)))
    },

    async deleteAllocation(orgId: string, id: string, tx: Tx): Promise<void> {
      await tx
        .delete(inventoryCostAllocations)
        .where(and(eq(inventoryCostAllocations.orgId, orgId), eq(inventoryCostAllocations.id, id)))
    },

    /**
     * Find all allocations for a given cost layer.
     */
    async findAllocationsByLayer(
      orgId: string,
      costLayerId: string,
      tx?: Tx
    ): Promise<InventoryCostAllocation[]> {
      return exec(tx)
        .select()
        .from(inventoryCostAllocations)
        .where(
          and(
            eq(inventoryCostAllocations.orgId, orgId),
            eq(inventoryCostAllocations.costLayerId, costLayerId)
          )
        )
    },
  }
}
