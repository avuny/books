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

const SCALE = 1_000_000n

/** Decimal string with up to 6 decimals to an exact integer of millionths. */
export const toMicro = (s: string): bigint => {
  const neg = s.startsWith("-")
  const [i = "0", f = ""] = (neg ? s.slice(1) : s).split(".")
  const v = BigInt(i || "0") * SCALE + BigInt((f + "000000").slice(0, 6))
  return neg ? -v : v
}

export const fromMicro = (v: bigint): string => {
  const neg = v < 0n
  const a = neg ? -v : v
  const frac = (a % SCALE).toString().padStart(6, "0").replace(/0+$/, "")
  return `${neg ? "-" : ""}${a / SCALE}${frac ? "." + frac : ""}`
}

/** Value of `take` out of a layer: the whole remainder takes the exact remaining value, so nothing is lost to rounding. */
export const valueOfTake = (remainingValue: bigint, remainingQty: bigint, take: bigint): bigint =>
  take === remainingQty ? remainingValue : (remainingValue * take) / remainingQty

export interface TakenFromLayer {
  layer: InventoryCostLayer
  qty: string
  value: number
}

export interface DeriveLayerInput {
  orgId: string
  fromLayer: InventoryCostLayer
  toInventoryItemId: string
  toInventoryItemBatchId: string | null
  qty: string
  value: number
  sourceMovementLineId: string
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
 
    /** Takes `qty` from the oldest layers (FIFO) and records an allocation per layer. Quantity no layer covers is returned. */
    async consumeFifo(
      input: {
        orgId: string
        inventoryItemId: string
        inventoryItemBatchId: string | null
        qty: string
        outgoingMovementLineId: string
      },
      tx: Tx
    ): Promise<{ taken: TakenFromLayer[]; uncoveredQty: string }> {
      const layers = await repo.findFifoLayers(input.orgId, input.inventoryItemId, input.inventoryItemBatchId, { forUpdate: true }, tx)
      return takeFrom(layers, input.qty, input.orgId, input.outgoingMovementLineId, tx)
    },

    /** Same as consumeFifo, but only from the layers one earlier movement line created (the transit layers of one dispatch line). */
    async consumeLayersOfSourceLine(
      input: { orgId: string; sourceMovementLineId: string; qty: string; outgoingMovementLineId: string },
      tx: Tx
    ): Promise<{ taken: TakenFromLayer[]; uncoveredQty: string }> {
      const layers = await repo.findOpenLayersBySourceLine(input.orgId, input.sourceMovementLineId, tx)
      return takeFrom(layers, input.qty, input.orgId, input.outgoingMovementLineId, tx)
    },

    /** A layer at another location that keeps its age and points back at the layer it came from. */
    async deriveLayer(input: DeriveLayerInput, tx: Tx): Promise<InventoryCostLayer> {
      return repo.insertCostLayer(
        {
          orgId: input.orgId,
          inventoryItemId: input.toInventoryItemId,
          itemId: input.fromLayer.itemId,
          inventoryItemBatchId: input.toInventoryItemBatchId ?? undefined,
          sourceMovementLineId: input.sourceMovementLineId,
          originCostLayerId: input.fromLayer.id,
          receivedQty: input.qty,
          remainingQty: input.qty,
          receivedValue: input.value,
          remainingValue: input.value,
          currency: input.fromLayer.currency,
          receivedAt: input.fromLayer.receivedAt,
        },
        tx
      )
    },

    /** Undoes every allocation one outgoing line made: the layers get their quantity and value back. */
    async restoreAllocationsOfLine(orgId: string, outgoingMovementLineId: string, tx: Tx): Promise<number> {
      const rows = await repo.findAllocationsByOutgoingLine(orgId, outgoingMovementLineId, tx)
      for (const a of rows) {
        await repo.restoreCostLayer(orgId, a.costLayerId, a.allocatedQty, String(a.allocatedValue), tx)
        await repo.deleteAllocation(orgId, a.id, tx)
      }
      return rows.length
    },
  }

  async function takeFrom(
    layers: InventoryCostLayer[],
    qty: string,
    orgId: string,
    outgoingMovementLineId: string,
    tx: Tx
  ): Promise<{ taken: TakenFromLayer[]; uncoveredQty: string }> {
    let need = toMicro(qty)
    const taken: TakenFromLayer[] = []
    for (const layer of layers) {
      if (need <= 0n) break
      const remaining = toMicro(layer.remainingQty)
      if (remaining <= 0n) continue
      const take = need < remaining ? need : remaining
      const value = valueOfTake(BigInt(layer.remainingValue), remaining, take)
      const out: TakenFromLayer = { layer, qty: fromMicro(take), value: Number(value) }
      await repo.insertCostAllocation(
        { orgId, outgoingMovementLineId, costLayerId: layer.id, allocatedQty: out.qty, allocatedValue: out.value },
        tx
      )
      await repo.depleteCostLayer(orgId, layer.id, out.qty, String(out.value), tx)
      taken.push(out)
      need -= take
    }
    return { taken, uncoveredQty: fromMicro(need) }
  }
}
