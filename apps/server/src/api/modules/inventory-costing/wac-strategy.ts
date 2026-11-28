import {
  InventoryCostingErrorCode as ErrCode,
  applyIssue,
  applyReceipt,
  averageUnitCost,
  fromMicro,
  inheritedShareMinor,
  inventoryCostingTranslationsEn,
  isPoolStateValid,
  toMicro,
  type DeterminedCost,
  type PoolState,
} from "@avuny/contracts"
import type { InventoryCostEntry, InventoryCostPool, Tx } from "@avuny/db"
import type { InventoryCostingRepository } from "./inventory-costing.types.js"

/**
 * Weighted average strategy (inventory-costing SPEC 4.2 to 4.6). One pool per item per
 * organization (owner decision 1). Every write locks the pool row first, so two postings on one
 * item run one after the other (R41). All math is exact integer math on millionths and minor
 * units (R11, R12, R17). Entries are append only (R15).
 *
 * Expected failures come back as values. Every check that can fail runs before the first write.
 */
type Err = (typeof ErrCode)[keyof typeof ErrCode]
export type WacFailure = { ok: false; error: Err; msg: string }
const fail = (error: Err): WacFailure => ({
  ok: false,
  error,
  msg: (inventoryCostingTranslationsEn.errors as Record<string, string>)[error] ?? error,
})

type Common = {
  orgId: string
  itemId: string
  movementLineId: string
  /** Positive numeric string, base unit. */
  quantity: string
  currency: string
  /** Document or movement date. */
  effectiveAt: Date
  /** Time of posting, used only to flag backdated entries (R22). */
  postedAt?: Date
  actorId?: string | null
}

export type WacReceiveInput = Common & {
  cost: DeterminedCost
  /** Sale return: the issue entry whose cost this stock inherits (R31). */
  sourceEntryId?: string | null
}
export type WacIssueInput = Common
export type WacEntryResult = { ok: true; entry: InventoryCostEntry; valueMinor: bigint }

const signedQty = (micro: bigint): string => (micro < 0n ? `-${fromMicro(-micro)}` : fromMicro(micro))
const parseSigned = (q: string): bigint => (q.startsWith("-") ? -toMicro(q.slice(1)) : toMicro(q))
const DAY_MS = 24 * 60 * 60 * 1000
const poolState = (p: InventoryCostPool): PoolState => ({
  qtyMicro: toMicro(p.onHandQty),
  valueMinor: BigInt(p.totalValue),
})

export function createWacStrategy(deps: { repository: InventoryCostingRepository }) {
  const repo = deps.repository

  /** Writes the entry and the new pool state. The pool row is already locked by the caller. */
  async function append(
    pool: InventoryCostPool,
    next: PoolState,
    entry: {
      input: Common
      kind: "RECEIPT" | "ISSUE" | "REVERSAL_IN" | "REVERSAL_OUT"
      qtyMicroDelta: bigint
      valueDelta: bigint
      costSource: "DOCUMENT" | "USER" | "INHERITED" | "CONFIRMED_PROPOSAL" | "METHOD"
      isZeroCost: boolean
      zeroCostReason: string | null
      proposedValueMinor: bigint | null
      sourceEntryId: string | null
      reversesEntryId: string | null
    },
    tx: Tx
  ): Promise<WacEntryResult> {
    const seq = pool.seq + 1
    const qtyAbs = entry.qtyMicroDelta < 0n ? -entry.qtyMicroDelta : entry.qtyMicroDelta
    const valueAbs = entry.valueDelta < 0n ? -entry.valueDelta : entry.valueDelta
    const unit = averageUnitCost({ qtyMicro: qtyAbs, valueMinor: valueAbs })
    const posted = entry.input.postedAt ?? new Date()
    const row = await repo.insertCostEntry(
      {
        orgId: entry.input.orgId,
        poolId: pool.id,
        itemId: entry.input.itemId,
        movementLineId: entry.input.movementLineId,
        kind: entry.kind,
        qtyDelta: signedQty(entry.qtyMicroDelta),
        valueDelta: Number(entry.valueDelta),
        qtyAfter: fromMicro(next.qtyMicro),
        valueAfter: Number(next.valueMinor),
        unitCost: unit,
        seq,
        costSource: entry.costSource,
        isZeroCost: entry.isZeroCost,
        zeroCostReason: entry.zeroCostReason,
        proposedValueMinor: entry.proposedValueMinor === null ? null : Number(entry.proposedValueMinor),
        sourceEntryId: entry.sourceEntryId,
        reversesEntryId: entry.reversesEntryId,
        currency: entry.input.currency,
        effectiveAt: entry.input.effectiveAt,
        isBackdated: posted.getTime() - entry.input.effectiveAt.getTime() > DAY_MS,
        createdBy: entry.input.actorId ?? null,
      },
      tx
    )
    // last_unit_cost keeps the average before the pool last emptied (used by the later negative stock design).
    const emptied = next.qtyMicro === 0n && poolState(pool).qtyMicro > 0n
    await repo.updatePool(
      entry.input.orgId,
      pool.id,
      {
        onHandQty: fromMicro(next.qtyMicro),
        totalValue: Number(next.valueMinor),
        avgUnitCost: averageUnitCost(next),
        lastUnitCost: emptied ? averageUnitCost(poolState(pool)) : pool.lastUnitCost,
        seq,
      },
      tx
    )
    return { ok: true, entry: row, valueMinor: valueAbs }
  }

  return {
    /** Receipt of q units with value v: pool.qty += q, pool.value += v (R11). Idempotent per movement line (R43). */
    async receive(input: WacReceiveInput, tx: Tx): Promise<WacEntryResult | WacFailure> {
      const existing = await repo.findEntryByMovementLine(input.orgId, input.movementLineId, tx)
      if (existing) return { ok: true, entry: existing, valueMinor: BigInt(existing.valueDelta) }
      const pool = await repo.lockPool(input.orgId, input.itemId, input.currency, tx)
      if (pool.currency !== input.currency) return fail(ErrCode.COST_CURRENCY_MISMATCH)
      let next: PoolState
      try {
        next = applyReceipt(poolState(pool), toMicro(input.quantity), input.cost.valueMinor)
      } catch {
        return fail(ErrCode.COST_INVALID)
      }
      if (!isPoolStateValid(next)) return fail(ErrCode.COST_POOL_INCONSISTENT)
      return append(
        pool,
        next,
        {
          input,
          kind: "RECEIPT",
          qtyMicroDelta: toMicro(input.quantity),
          valueDelta: input.cost.valueMinor,
          costSource: input.cost.source,
          isZeroCost: input.cost.isZeroCost,
          zeroCostReason: input.cost.zeroCostReason,
          proposedValueMinor: input.cost.proposedValueMinor,
          sourceEntryId: input.sourceEntryId ?? null,
          reversesEntryId: null,
        },
        tx
      )
    },

    /**
     * Issue of q units: only if q <= pool.qty (R19, owner decision 3, even when the item allows
     * negative stock). The last unit takes the remainder (R12).
     */
    async issue(input: WacIssueInput, tx: Tx): Promise<WacEntryResult | WacFailure> {
      const existing = await repo.findEntryByMovementLine(input.orgId, input.movementLineId, tx)
      if (existing) return { ok: true, entry: existing, valueMinor: -BigInt(existing.valueDelta) }
      const pool = await repo.lockPool(input.orgId, input.itemId, input.currency, tx)
      if (pool.currency !== input.currency) return fail(ErrCode.COST_CURRENCY_MISMATCH)
      const qty = toMicro(input.quantity)
      const state = poolState(pool)
      if (qty > state.qtyMicro) return fail(ErrCode.COST_NEGATIVE_STOCK_NOT_SUPPORTED)
      const applied = applyIssue(state, qty)
      if (!applied || !isPoolStateValid(applied.pool)) return fail(ErrCode.COST_POOL_INCONSISTENT)
      return append(
        pool,
        applied.pool,
        {
          input,
          kind: "ISSUE",
          qtyMicroDelta: -qty,
          valueDelta: -applied.valueMinor,
          costSource: "METHOD",
          isZeroCost: applied.valueMinor === 0n,
          zeroCostReason: null,
          proposedValueMinor: null,
          sourceEntryId: null,
          reversesEntryId: null,
        },
        tx
      )
    },

    /**
     * Reverses an earlier entry with a new entry that points at it (R26, R30).
     * - Reverse of a value-in (receipt, return, gain): allowed only if no value-out entry came after it
     *   and the pool still holds the quantity. Removes exactly the entry's quantity and value (R27).
     * - Reverse of a value-out (issue): puts back the original quantity and issue value (R28).
     */
    async reverse(
      input: Common & { reversesEntryId: string },
      tx: Tx
    ): Promise<WacEntryResult | WacFailure> {
      const done = await repo.findEntryByMovementLine(input.orgId, input.movementLineId, tx)
      if (done) return { ok: true, entry: done, valueMinor: BigInt(Math.abs(done.valueDelta)) }
      const original = await repo.findEntryById(input.orgId, input.reversesEntryId, tx)
      if (!original || original.itemId !== input.itemId) return fail(ErrCode.COST_SOURCE_NOT_FOUND)
      if (original.reversesEntryId || original.kind === "REVERSAL_IN" || original.kind === "REVERSAL_OUT") {
        return fail(ErrCode.COST_INVALID)
      }
      if (await repo.findReversalOfEntry(input.orgId, original.id, tx)) return fail(ErrCode.COST_INVALID)
      const pool = await repo.lockPool(input.orgId, input.itemId, original.currency, tx)
      const state = poolState(pool)
      const qty = parseSigned(original.qtyDelta)
      const value = BigInt(original.valueDelta)
      if (qty > 0n) {
        // Value-in: take back exactly what it added.
        if (
          (await repo.hasValueOutAfter(input.orgId, pool.id, original.seq, tx)) ||
          state.qtyMicro < qty ||
          state.valueMinor < value
        ) {
          return fail(ErrCode.COST_REVERSAL_BLOCKED_STOCK_USED)
        }
        const next = { qtyMicro: state.qtyMicro - qty, valueMinor: state.valueMinor - value }
        if (!isPoolStateValid(next)) return fail(ErrCode.COST_REVERSAL_BLOCKED_STOCK_USED)
        return append(
          pool,
          next,
          {
            input: { ...input, currency: original.currency },
            kind: "REVERSAL_OUT",
            qtyMicroDelta: -qty,
            valueDelta: -value,
            costSource: "INHERITED",
            isZeroCost: original.isZeroCost,
            zeroCostReason: null,
            proposedValueMinor: null,
            sourceEntryId: null,
            reversesEntryId: original.id,
          },
          tx
        )
      }
      // Value-out: restore the original quantity and issue value.
      const restoreQty = -qty
      const restoreValue = -value
      let next: PoolState
      try {
        next = applyReceipt(state, restoreQty, restoreValue)
      } catch {
        return fail(ErrCode.COST_INVALID)
      }
      if (!isPoolStateValid(next)) return fail(ErrCode.COST_POOL_INCONSISTENT)
      return append(
        pool,
        next,
        {
          input: { ...input, currency: original.currency },
          kind: "REVERSAL_IN",
          qtyMicroDelta: restoreQty,
          valueDelta: restoreValue,
          costSource: "INHERITED",
          isZeroCost: original.isZeroCost,
          zeroCostReason: null,
          proposedValueMinor: null,
          sourceEntryId: null,
          reversesEntryId: original.id,
        },
        tx
      )
    },

    /**
     * Cost a sale return inherits from the sale's issue entry (R31, AC9): value = original value x
     * returned qty / original qty, round half up, the last return takes the remainder. Fails with
     * COST_SOURCE_EXCEEDED above the original quantity.
     */
    async inheritedValueFor(
      orgId: string,
      itemId: string,
      sourceEntryId: string,
      quantity: string,
      tx: Tx
    ): Promise<{ ok: true; valueMinor: bigint } | WacFailure> {
      const source = await repo.findEntryById(orgId, sourceEntryId, tx)
      if (!source || source.kind !== "ISSUE" || source.itemId !== itemId) return fail(ErrCode.COST_SOURCE_NOT_FOUND)
      const already = await repo.sumInheritedFrom(orgId, source.id, tx)
      const share = inheritedShareMinor({
        totalQtyMicro: -parseSigned(source.qtyDelta),
        totalValueMinor: -BigInt(source.valueDelta),
        alreadyQtyMicro: parseSigned(already.qty),
        alreadyValueMinor: BigInt(already.value),
        qtyMicro: toMicro(quantity),
      })
      if (share === null) return fail(ErrCode.COST_SOURCE_EXCEEDED)
      return { ok: true, valueMinor: share }
    },
  }
}

export type WacStrategy = ReturnType<typeof createWacStrategy>
