import { and, asc, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm"
import {
  inventoryCostEntries,
  inventoryCostPools,
  items,
  type InventoryCostEntry,
  type InventoryCostPool,
  type NewInventoryCostEntry,
  inventoryCostAllocations,
  inventoryCostLayers,
  inventoryItems,
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
    /**
     * Newest receipt layer with a real value for an item, at one location first and then anywhere.
     * Only a proposal source (SPEC R5): the result is shown to the user, never applied silently.
     */
    async findLatestCostedLayer(
      orgId: string,
      itemId: string,
      locationId: string,
      tx?: Tx
    ): Promise<InventoryCostLayer | null> {
      const base = [
        eq(inventoryCostLayers.orgId, orgId),
        eq(inventoryCostLayers.itemId, itemId),
        gt(inventoryCostLayers.receivedQty, "0"),
        gt(inventoryCostLayers.receivedValue, 0),
      ]
      const here = await exec(tx)
        .select({ layer: inventoryCostLayers })
        .from(inventoryCostLayers)
        .innerJoin(inventoryItems, eq(inventoryItems.id, inventoryCostLayers.inventoryItemId))
        .where(and(...base, eq(inventoryItems.locationId, locationId)))
        .orderBy(desc(inventoryCostLayers.receivedAt), desc(inventoryCostLayers.id))
        .limit(1)
      if (here[0]) return here[0].layer
      const [any] = await exec(tx)
        .select()
        .from(inventoryCostLayers)
        .where(and(...base))
        .orderBy(desc(inventoryCostLayers.receivedAt), desc(inventoryCostLayers.id))
        .limit(1)
      return any ?? null
    },

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
    // ---- weighted average pools and entries (SPEC section 5.1) ----

    /** The item's valuation method, or null when the item does not exist in this organization. */
    async findValuationMethod(orgId: string, itemId: string, tx?: Tx): Promise<string | null> {
      const [row] = await exec(tx)
        .select({ method: items.inventoryValuationMethod })
        .from(items)
        .where(and(eq(items.orgId, orgId), eq(items.id, itemId)))
        .limit(1)
      return row?.method ?? null
    },

    /**
     * Returns the organization wide pool of an item with its row locked, creating an empty one on
     * first use. Every WAC write starts here, so two postings on one item serialize on this row (R41).
     */
    async lockPool(orgId: string, itemId: string, currency: string, tx: Tx): Promise<InventoryCostPool> {
      const find = () =>
        tx
          .select()
          .from(inventoryCostPools)
          .where(
            and(
              eq(inventoryCostPools.orgId, orgId),
              eq(inventoryCostPools.itemId, itemId),
              isNull(inventoryCostPools.scopeWarehouseId)
            )
          )
          .for("update")
          .limit(1)
      const [existing] = await find()
      if (existing) return existing
      await tx
        .insert(inventoryCostPools)
        .values({ orgId, itemId, currency })
        .onConflictDoNothing()
      const [row] = await find()
      if (!row) throw new Error("Failed to create cost pool")
      return row
    },

    async insertCostEntry(values: NewInventoryCostEntry, tx: Tx): Promise<InventoryCostEntry> {
      const [row] = await tx.insert(inventoryCostEntries).values(values).returning()
      if (!row) throw new Error("Failed to insert cost entry")
      return row
    },

    async updatePool(
      orgId: string,
      poolId: string,
      values: { onHandQty: string; totalValue: number; avgUnitCost: string; lastUnitCost: string; seq: number },
      tx: Tx
    ): Promise<void> {
      await tx
        .update(inventoryCostPools)
        .set({ ...values, updatedAt: sql`now()` })
        .where(and(eq(inventoryCostPools.orgId, orgId), eq(inventoryCostPools.id, poolId)))
    },

    async findEntryByMovementLine(orgId: string, movementLineId: string, tx: Tx): Promise<InventoryCostEntry | null> {
      const [row] = await tx
        .select()
        .from(inventoryCostEntries)
        .where(and(eq(inventoryCostEntries.orgId, orgId), eq(inventoryCostEntries.movementLineId, movementLineId)))
        .limit(1)
      return row ?? null
    },

    async findEntryById(orgId: string, entryId: string, tx: Tx): Promise<InventoryCostEntry | null> {
      const [row] = await tx
        .select()
        .from(inventoryCostEntries)
        .where(and(eq(inventoryCostEntries.orgId, orgId), eq(inventoryCostEntries.id, entryId)))
        .limit(1)
      return row ?? null
    },

    async findReversalOfEntry(orgId: string, entryId: string, tx: Tx): Promise<InventoryCostEntry | null> {
      const [row] = await tx
        .select()
        .from(inventoryCostEntries)
        .where(and(eq(inventoryCostEntries.orgId, orgId), eq(inventoryCostEntries.reversesEntryId, entryId)))
        .limit(1)
      return row ?? null
    },

    /** True when a value-out entry exists on the pool after the given seq (R27 rule 1). */
    async hasValueOutAfter(orgId: string, poolId: string, seq: number, tx: Tx): Promise<boolean> {
      const rows = await tx
        .select({ id: inventoryCostEntries.id })
        .from(inventoryCostEntries)
        .where(
          and(
            eq(inventoryCostEntries.orgId, orgId),
            eq(inventoryCostEntries.poolId, poolId),
            gt(inventoryCostEntries.seq, seq),
            inArray(inventoryCostEntries.kind, ["ISSUE", "REVERSAL_OUT"])
          )
        )
        .limit(1)
      return rows.length > 0
    },

    /** Entries that inherited from a source entry (sale returns): the quantity and value taken so far (R31). */
    async sumInheritedFrom(
      orgId: string,
      sourceEntryId: string,
      tx: Tx
    ): Promise<{ qty: string; value: string }> {
      const [row] = await tx
        .select({
          qty: sql<string>`coalesce(sum(${inventoryCostEntries.qtyDelta}), 0)::text`,
          value: sql<string>`coalesce(sum(${inventoryCostEntries.valueDelta}), 0)::text`,
        })
        .from(inventoryCostEntries)
        .where(
          and(
            eq(inventoryCostEntries.orgId, orgId),
            eq(inventoryCostEntries.sourceEntryId, sourceEntryId),
            // A return that was reversed frees its quantity again.
            sql`not exists (select 1 from inventory_cost_entries r where r.org_id = ${orgId} and r.reverses_entry_id = ${inventoryCostEntries.id})`
          )
        )
      return { qty: row?.qty ?? "0", value: row?.value ?? "0" }
    },
  }
}
