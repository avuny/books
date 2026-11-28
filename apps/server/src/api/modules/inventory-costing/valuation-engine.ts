import {
  InventoryCostingErrorCode as ErrCode,
  allocateFifo,
  determineCost,
  fromMicro,
  inventoryCostingTranslationsEn,
  toMicro,
  type CostInput,
  type DeterminedCost,
} from "@avuny/contracts"
import type { Tx } from "@avuny/db"
import type { InventoryCostingService } from "./inventory-costing.types.js"

/**
 * Valuation engine, FIFO strategy (inventory-costing SPEC section 6). One place that decides the
 * cost of stock coming in and the cost of stock going out. Callers hand it the movement line they
 * just posted and get the exact value back; they never compute cost themselves (R4, R38).
 *
 * Phase 2a: the engine exists and is tested, no module calls it yet. Phase 2b wires it into the
 * stock movement post and reverse path, phase 2c and 2d move the callers over.
 *
 * Expected failures come back as values. Every check that can fail runs before the first write of
 * this call (the production transaction rolls back on a throw, local tests cannot observe it).
 */
export type EngineFailure = { ok: false; error: Err; msg: string }
const code = (error: Err): EngineFailure => ({
  ok: false,
  error,
  msg: (inventoryCostingTranslationsEn.errors as Record<string, string>)[error] ?? error,
})

type Err = (typeof ErrCode)[keyof typeof ErrCode]

export type ReceiveInput = {
  orgId: string
  inventoryItemId: string
  itemId: string
  inventoryItemBatchId: string | null
  sourceMovementLineId: string
  /** Quantity in the base unit, positive numeric string. */
  quantity: string
  currency: string
  receivedAt: Date
  /** Required. Undefined fails with STOCK_MOVEMENT_COST_REQUIRED (R1). */
  cost: CostInput | undefined
  /**
   * For INHERITED cost: the value looked up from the source (an allocation, a layer, a movement)
   * and the layer this stock came from. The engine, not the caller input, decides the number.
   */
  inherited?: { valueMinor: bigint; originCostLayerId: string | null }
}

export type IssueInput = {
  orgId: string
  inventoryItemId: string
  inventoryItemBatchId: string | null
  outgoingMovementLineId: string
  quantity: string
}

export type IssueResult = {
  ok: true
  totalValueMinor: bigint
  slices: { layerId: string; quantity: string; valueMinor: bigint }[]
}

export type MoveInput = {
  orgId: string
  fromInventoryItemId: string
  fromBatchId: string | null
  toInventoryItemId: string
  toBatchId: string | null
  itemId: string
  /** The transfer line. It is the consuming line of the source layers and the source of the new ones. */
  movementLineId: string
  quantity: string
  /**
   * true: the whole quantity must be covered by source layers (R6, R34).
   * false (reversals): moves what is covered and leaves the rest, so a correction never fails on
   * stock that was already uncosted before this change.
   */
  strict: boolean
}

export function createValuationEngine(deps: { costing: InventoryCostingService }) {
  const costing = deps.costing

  return {
    /** Decides the cost of one value-in line without writing anything. */
    determine(input: ReceiveInput): { ok: true; cost: DeterminedCost } | EngineFailure {
      const inherited = input.inherited?.valueMinor
      const res = determineCost(input.cost, input.quantity, inherited)
      if (!res.ok) return code(res.error)
      return { ok: true, cost: res.cost }
    },

    /** Costs a value-in line and writes its FIFO layer (cost source and zero flag included). */
    async receive(
      input: ReceiveInput,
      tx?: Tx
    ): Promise<{ ok: true; layerId: string; cost: DeterminedCost } | EngineFailure> {
      const determined = this.determine(input)
      if (!determined.ok) return determined
      const layer = await costing.createCostLayer(
        {
          orgId: input.orgId,
          inventoryItemId: input.inventoryItemId,
          itemId: input.itemId,
          inventoryItemBatchId: input.inventoryItemBatchId,
          sourceMovementLineId: input.sourceMovementLineId,
          originCostLayerId: input.inherited?.originCostLayerId ?? null,
          receivedQty: input.quantity,
          receivedValue: Number(determined.cost.valueMinor),
          currency: input.currency,
          receivedAt: input.receivedAt,
          costSource: determined.cost.source,
          isZeroCost: determined.cost.isZeroCost,
        },
        tx
      )
      return { ok: true, layerId: layer.id, cost: determined.cost }
    },

    /**
     * Costs a value-out line from FIFO layers and records the allocations. The whole quantity must
     * be covered (R6): otherwise nothing is written and the call fails with COST_UNDETERMINED.
     */
    async issue(input: IssueInput, tx?: Tx): Promise<IssueResult | EngineFailure> {
      const layers = await costing.getFifoLayers(
        input.orgId,
        input.inventoryItemId,
        input.inventoryItemBatchId,
        { forUpdate: true },
        tx
      )
      const plan = allocateFifo(
        layers.map((l) => ({
          id: l.id,
          remainingQtyMicro: toMicro(l.remainingQty),
          remainingValueMinor: BigInt(l.remainingValue),
        })),
        toMicro(input.quantity)
      )
      if (!plan) return code(ErrCode.COST_UNDETERMINED)
      for (const s of plan.slices) {
        await costing.recordAllocation(
          {
            orgId: input.orgId,
            outgoingMovementLineId: input.outgoingMovementLineId,
            costLayerId: s.layerId,
            allocatedQty: fromMicro(s.qtyMicro),
            allocatedValue: Number(s.valueMinor),
          },
          tx
        )
      }
      return {
        ok: true,
        totalValueMinor: plan.totalValueMinor,
        slices: plan.slices.map((s) => ({
          layerId: s.layerId,
          quantity: fromMicro(s.qtyMicro),
          valueMinor: s.valueMinor,
        })),
      }
    },

    /**
     * Internal move (transfer, transit, return to source): no value change. Takes FIFO layers at the
     * source and writes inherited layers at the destination, one per consumed layer, keeping each
     * layer's received date and origin so later FIFO order and value are exact.
     */
    async move(
      input: MoveInput,
      tx?: Tx
    ): Promise<{ ok: true; movedQuantity: string; totalValueMinor: bigint } | EngineFailure> {
      const layers = await costing.getFifoLayers(
        input.orgId,
        input.fromInventoryItemId,
        input.fromBatchId,
        { forUpdate: true },
        tx
      )
      const wanted = toMicro(input.quantity)
      const available = layers.reduce((n, l) => n + toMicro(l.remainingQty), 0n)
      if (available < wanted && input.strict) return code(ErrCode.COST_UNDETERMINED)
      const take = available < wanted ? available : wanted
      if (take <= 0n) return { ok: true, movedQuantity: "0", totalValueMinor: 0n }
      const plan = allocateFifo(
        layers.map((l) => ({
          id: l.id,
          remainingQtyMicro: toMicro(l.remainingQty),
          remainingValueMinor: BigInt(l.remainingValue),
        })),
        take
      )
      if (!plan) return code(ErrCode.COST_UNDETERMINED)
      const byId = new Map(layers.map((l) => [l.id, l]))
      for (const sl of plan.slices) {
        const origin = byId.get(sl.layerId)!
        await costing.recordAllocation(
          {
            orgId: input.orgId,
            outgoingMovementLineId: input.movementLineId,
            costLayerId: sl.layerId,
            allocatedQty: fromMicro(sl.qtyMicro),
            allocatedValue: Number(sl.valueMinor),
          },
          tx
        )
        await costing.createCostLayer(
          {
            orgId: input.orgId,
            inventoryItemId: input.toInventoryItemId,
            itemId: input.itemId,
            inventoryItemBatchId: input.toBatchId,
            sourceMovementLineId: input.movementLineId,
            originCostLayerId: origin.id,
            receivedQty: fromMicro(sl.qtyMicro),
            receivedValue: Number(sl.valueMinor),
            currency: origin.currency,
            receivedAt: origin.receivedAt,
            costSource: "INHERITED",
            isZeroCost: origin.isZeroCost,
          },
          tx
        )
      }
      return { ok: true, movedQuantity: fromMicro(take), totalValueMinor: plan.totalValueMinor }
    },
  }
}

export type ValuationEngine = ReturnType<typeof createValuationEngine>
