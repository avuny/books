import {
  StockMovementErrorCode as Err,
  STOCK_MOVEMENT_MAX_LINES,
  addDecimal,
  balanceKey,
  batchAllowsIntent,
  compareDecimal,
  isPositiveQuantity,
  negateDecimal,
  resolveSides,
  stockMovementTranslationsEn,
  type ItemBatchStockDto,
  type ItemStockDto,
  type OnHandQuery,
  type OnHandResponse,
  type PostStockMovementInput,
  type ReverseStockMovementInput,
  type StockBalanceListQuery,
  type StockBalanceListResponse,
  type StockMovementDto,
  type StockMovementLineHistoryQuery,
  type StockMovementLineHistoryResponse,
  type SystemLocationIds,
  type WarehouseLocationPostingIntent,
} from "@avuny/contracts"
import type { NewStockMovement, Tx } from "@avuny/db"
import { fail, ok, type Result } from "@avuny/utils"
import { toHistoryItemDto, toStockBalanceDto, toStockMovementDto } from "./stock-movement.mapper.js"
import type { BalanceDelta, BalanceKey } from "./stock-movement.repository.js"
import type { Code, StockBatchInfo, StockMovementServiceDeps } from "./stock-movement.types.js"
import { DummyStockItems } from "./testing.js"

/** Expected failures travel as a value. Every check that can fail runs before the first write. */
type Failure = { failed: true; error: Code; msg: string }
const failure = (error: Code, msg: string): Failure => ({ failed: true, error, msg })
const isFailure = (v: unknown): v is Failure =>
  typeof v === "object" && v !== null && (v as Failure).failed === true
const toFail = (f: Failure) => fail({ error: f.error, msg: f.msg })

const message = (code: Err) => stockMovementTranslationsEn.errors[code]

/** One line with both sides resolved. An intent of null marks a counterparty side (no stock effect). */
type ResolvedLine = {
  itemId: string
  batchId: string | null
  quantity: string
  fromLocationId: string
  toLocationId: string
  fromIntent: WarehouseLocationPostingIntent | null
  toIntent: WarehouseLocationPostingIntent | null
}
type Header = Omit<NewStockMovement, "orgId" | "createdBy">

const keyOf = (k: BalanceKey) => balanceKey(k.locationId, k.itemId, k.batchId)

/** Plain code point order, the same in every transaction, so rows are always taken in the same order. */
const byKey = (a: BalanceKey, b: BalanceKey) => {
  const x = keyOf(a)
  const y = keyOf(b)
  return x < y ? -1 : x > y ? 1 : 0
}

export function createStockMovementService(deps: StockMovementServiceDeps) {
  const repo = deps.repository
  const locations = deps.locations
  const batches = deps.batches
  const items = deps.items ?? new DummyStockItems()

  /**
   * Checks and writes one posting: header, lines and balances, in one transaction owned by the caller.
   * Order matters: item, batch and location rules and the stock check come first and may return a
   * failure; the first write is the header, so a failure never leaves partial rows behind. A caller
   * that has already written something in the same transaction (a new item, new batches) must roll
   * back itself when this returns a failure.
   * `forwardChecks` is false for reversals: a correction must work on an inactive item or a blocked batch.
   */
  const commit = async (
    tx: Tx,
    orgId: string,
    actorId: string | null,
    header: Header,
    lines: ResolvedLine[],
    system: SystemLocationIds,
    forwardChecks: boolean
  ): Promise<Failure | StockMovementDto> => {
    // 1. items exist, are active and keep stock
    const itemIds = [...new Set(lines.map((l) => l.itemId))]
    const policies = await items.findPolicies(orgId, itemIds, tx)
    for (const id of itemIds) {
      const policy = policies.get(id)
      if (!policy) return failure(Err.STOCK_MOVEMENT_ITEM_NOT_FOUND, message(Err.STOCK_MOVEMENT_ITEM_NOT_FOUND))
      if (forwardChecks && !policy.isActive) {
        return failure(Err.STOCK_MOVEMENT_ITEM_INACTIVE, message(Err.STOCK_MOVEMENT_ITEM_INACTIVE))
      }
      if (forwardChecks && !policy.tracksStock) {
        return failure(Err.STOCK_MOVEMENT_ITEM_NOT_STOCKED, message(Err.STOCK_MOVEMENT_ITEM_NOT_STOCKED))
      }
    }

    // 2. batches: present exactly for batch-tracked items, of the same item, in a status that allows this
    const batchIds = [...new Set(lines.flatMap((l) => (l.batchId ? [l.batchId] : [])))]
    const batchInfo: Map<string, StockBatchInfo> =
      batchIds.length > 0 ? await batches.findForPosting(orgId, batchIds, tx) : new Map()
    for (const line of lines) {
      const tracked = policies.get(line.itemId)?.isBatchTracked ?? false
      if (forwardChecks && tracked && !line.batchId) {
        return failure(Err.STOCK_MOVEMENT_BATCH_REQUIRED, message(Err.STOCK_MOVEMENT_BATCH_REQUIRED))
      }
      if (forwardChecks && !tracked && line.batchId) {
        return failure(Err.STOCK_MOVEMENT_BATCH_NOT_TRACKED, message(Err.STOCK_MOVEMENT_BATCH_NOT_TRACKED))
      }
      if (!line.batchId) continue
      const info = batchInfo.get(line.batchId)
      if (!info || info.itemId !== line.itemId) {
        return failure(Err.STOCK_MOVEMENT_BATCH_NOT_FOUND, message(Err.STOCK_MOVEMENT_BATCH_NOT_FOUND))
      }
      if (!forwardChecks) continue
      const policy = policies.get(line.itemId)
      if (policy?.isExpiryTracked && !info.expiresOn) {
        return failure(
          Err.STOCK_MOVEMENT_EXPIRY_DATE_REQUIRED,
          message(Err.STOCK_MOVEMENT_EXPIRY_DATE_REQUIRED)
        )
      }
      for (const intent of [line.fromIntent, line.toIntent]) {
        if (intent && !batchAllowsIntent(info.status, intent)) {
          return failure(
            Err.STOCK_MOVEMENT_BATCH_NOT_AVAILABLE,
            `${message(Err.STOCK_MOVEMENT_BATCH_NOT_AVAILABLE)} (batch ${line.batchId} is ${info.status})`
          )
        }
      }
    }

    // 3. every real location accepts this kind of posting (shared lock, same gate as every module)
    const warehouseOf = new Map<string, string>()
    const checked = new Set<string>()
    for (const line of lines) {
      for (const [id, intent] of [
        [line.fromLocationId, line.fromIntent],
        [line.toLocationId, line.toIntent],
      ] as const) {
        if (!intent || checked.has(`${id}:${intent}`)) continue
        checked.add(`${id}:${intent}`)
        const res = await locations.assertPostable(orgId, id, intent, tx)
        if (!res.success) return failure(res.error, res.msg)
        warehouseOf.set(id, res.data.warehouseId)
      }
    }

    // 4. lock EVERY balance row the posting touches, in key order, in one step. Locking both sides up
    // front is what keeps two opposite transfers (X to Y and Y to X) from deadlocking.
    const touched = new Map<string, BalanceKey>()
    const required = new Map<string, BalanceKey & { quantity: string }>()
    for (const line of lines) {
      if (line.fromIntent) {
        const key: BalanceKey = { locationId: line.fromLocationId, itemId: line.itemId, batchId: line.batchId }
        touched.set(keyOf(key), key)
        // Only real warehouses of items that allow it may go negative; stock in transit never does.
        const mayGoNegative =
          policies.get(line.itemId)?.allowNegativeStock === true && line.fromLocationId !== system.transit
        if (!mayGoNegative) {
          const previous = required.get(keyOf(key))
          required.set(keyOf(key), {
            ...key,
            quantity: previous ? addDecimal(previous.quantity, line.quantity) : line.quantity,
          })
        }
      }
      if (line.toIntent) {
        const key: BalanceKey = { locationId: line.toLocationId, itemId: line.itemId, batchId: line.batchId }
        touched.set(keyOf(key), key)
      }
    }
    const onHand = await repo.lockBalances(orgId, [...touched.values()].sort(byKey), tx)

    // 5. enough stock where stock leaves (a missing row means zero on hand)
    for (const need of [...required.values()].sort(byKey)) {
      const available = onHand.get(keyOf(need)) ?? "0"
      if (compareDecimal(available, need.quantity) < 0) {
        return failure(
          Err.STOCK_MOVEMENT_INSUFFICIENT_STOCK,
          `${message(Err.STOCK_MOVEMENT_INSUFFICIENT_STOCK)} (item ${need.itemId}${need.batchId ? `, batch ${need.batchId}` : ""}, location ${need.locationId}: available ${available}, required ${need.quantity})`
        )
      }
    }

    // 6. writes: header first (a taken source or a second reversal stops here), then lines, then balances
    const inserted = await repo.insertMovement({ ...header, orgId, createdBy: actorId }, tx)
    if (!inserted.ok) {
      const code =
        inserted.reason === "already_reversed"
          ? Err.STOCK_MOVEMENT_ALREADY_REVERSED
          : Err.STOCK_MOVEMENT_SOURCE_ALREADY_POSTED
      return failure(code, message(code))
    }
    const rows = await repo.insertLines(
      lines.map((l, i) => ({
        orgId,
        movementId: inserted.row.id,
        lineNo: i + 1,
        itemId: l.itemId,
        batchId: l.batchId,
        fromLocationId: l.fromLocationId,
        toLocationId: l.toLocationId,
        quantity: l.quantity,
      })),
      tx
    )

    const deltas = new Map<string, BalanceDelta>()
    const add = (locationId: string, itemId: string, batchId: string | null, delta: string) => {
      const key = balanceKey(locationId, itemId, batchId)
      const previous = deltas.get(key)
      deltas.set(key, {
        locationId,
        itemId,
        batchId,
        warehouseId: warehouseOf.get(locationId)!, // every side with an intent was checked above
        delta: previous ? addDecimal(previous.delta, delta) : delta,
      })
    }
    for (const l of lines) {
      if (l.fromIntent) add(l.fromLocationId, l.itemId, l.batchId, negateDecimal(l.quantity))
      if (l.toIntent) add(l.toLocationId, l.itemId, l.batchId, l.quantity)
    }
    await repo.applyBalanceDeltas(
      orgId,
      [...deltas.values()].filter((d) => compareDecimal(d.delta, "0") !== 0).sort(byKey),
      tx
    )

    return toStockMovementDto(inserted.row, rows)
  }

  return {
    /**
     * Posts one stock movement. INTERNAL: no actor permission check; the calling module (purchasing,
     * sales, transfers, assembly, opening stock) authorized its own operation, and passes its
     * transaction so the document and its stock move commit together.
     * Business logic:
     *  - the type fixes which side is a counterparty (supplier, customer, adjustment, production);
     *    the caller supplies only the real locations, and every line ends up with both sides.
     *  - a batch-tracked item needs a batch on every line and any other item must have none; the
     *    batch must belong to the item, and its status must allow the posting (batchAllowsIntent).
     *  - every real location must accept the posting (active, stockable, receivable/pickable, not
     *    blocked); stock cannot leave a location (and batch) below zero unless the item allows it.
     *  - a source document (sourceType + sourceId) can be posted once.
     *  - header, lines and balances are written in one transaction; nothing is audited separately,
     *    the ledger is the audit trail.
     * A failure is returned before anything is written by this call. If the caller wrote rows of its
     * own before calling (a new item, new batches), it must roll its transaction back on failure.
     */
    async post(
      actorId: string | null,
      orgId: string,
      input: PostStockMovementInput,
      tx?: Tx
    ): Promise<Result<StockMovementDto, Code>> {
      if (input.lines.length === 0) {
        return fail({ error: Err.STOCK_MOVEMENT_NO_LINES, msg: message(Err.STOCK_MOVEMENT_NO_LINES) })
      }
      if (input.lines.length > STOCK_MOVEMENT_MAX_LINES) {
        return fail({ error: Err.STOCK_MOVEMENT_TOO_MANY_LINES, msg: message(Err.STOCK_MOVEMENT_TOO_MANY_LINES) })
      }
      if (input.lines.some((l) => !isPositiveQuantity(l.quantity))) {
        return fail({ error: Err.STOCK_MOVEMENT_INVALID_QUANTITY, msg: message(Err.STOCK_MOVEMENT_INVALID_QUANTITY) })
      }

      const run = async (t: Tx): Promise<Failure | StockMovementDto> => {
        const system = await repo.findSystemLocationIds(orgId, t)
        const lines: ResolvedLine[] = []
        for (const [index, line] of input.lines.entries()) {
          const sides = resolveSides(input.type, line, system)
          if (!sides.ok) return failure(sides.error, `${message(sides.error)} (line ${index + 1})`)
          lines.push({
            itemId: line.itemId,
            batchId: line.batchId ?? null,
            quantity: line.quantity,
            ...sides.value,
          })
        }
        return commit(
          t,
          orgId,
          actorId,
          {
            type: input.type,
            postedAt: input.postedAt ? new Date(input.postedAt) : new Date(),
            sourceType: input.sourceType ?? null,
            sourceId: input.sourceId ?? null,
            sourceRef: input.sourceRef ?? null,
            note: input.note ?? null,
          },
          lines,
          system,
          true
        )
      }
      const outcome = await (tx ? run(tx) : repo.transaction(run))
      if (isFailure(outcome)) return toFail(outcome)
      return ok({ data: outcome, msg: "Stock movement posted successfully" })
    },

    /**
     * Reverses a posted movement by posting a new one that swaps from and to on every line.
     * Business logic:
     *  - a movement can be reversed once, and a reversal cannot be reversed (post the original again).
     *  - the reversal keeps the type, batches and source reference of the original and links to it.
     *  - corrections use the "adjust" intent, so they work on blocked locations and blocked or
     *    recalled batches; stock still cannot go below zero (reversing a receipt needs the stock to
     *    still be there).
     *  - the original row is never changed.
     */
    async reverse(
      actorId: string | null,
      orgId: string,
      movementId: string,
      input: ReverseStockMovementInput = {},
      tx?: Tx
    ): Promise<Result<StockMovementDto, Code>> {
      const run = async (t: Tx): Promise<Failure | StockMovementDto> => {
        const original = await repo.findMovement(orgId, movementId, t, { forUpdate: true })
        if (!original) return failure(Err.STOCK_MOVEMENT_NOT_FOUND, message(Err.STOCK_MOVEMENT_NOT_FOUND))
        if (original.reversalOfId) {
          return failure(Err.STOCK_MOVEMENT_CANNOT_REVERSE_REVERSAL, message(Err.STOCK_MOVEMENT_CANNOT_REVERSE_REVERSAL))
        }
        if (await repo.findReversalOf(orgId, movementId, t)) {
          return failure(Err.STOCK_MOVEMENT_ALREADY_REVERSED, message(Err.STOCK_MOVEMENT_ALREADY_REVERSED))
        }

        const system = await repo.findSystemLocationIds(orgId, t)
        // Counterparty locations carry no stock; transit does, so it is not one of them.
        const counterparties = new Set<string>()
        for (const [role, id] of Object.entries(system)) if (id && role !== "transit") counterparties.add(id)

        const stored = await repo.findLines(orgId, movementId, t)
        const lines: ResolvedLine[] = stored.map((l) => ({
          itemId: l.itemId,
          batchId: l.batchId,
          quantity: l.quantity,
          fromLocationId: l.toLocationId,
          toLocationId: l.fromLocationId,
          fromIntent: counterparties.has(l.toLocationId) ? null : ("adjust" as const),
          toIntent: counterparties.has(l.fromLocationId) ? null : ("adjust" as const),
        }))
        return commit(
          t,
          orgId,
          actorId,
          {
            type: original.type,
            postedAt: input.postedAt ? new Date(input.postedAt) : new Date(),
            sourceType: original.sourceType,
            sourceId: original.sourceId,
            sourceRef: original.sourceRef,
            note: input.note ?? null,
            reversalOfId: original.id,
          },
          lines,
          system,
          false
        )
      }
      const outcome = await (tx ? run(tx) : repo.transaction(run))
      if (isFailure(outcome)) return toFail(outcome)
      return ok({ data: outcome, msg: "Stock movement reversed successfully" })
    },

    /** Reads one movement with its lines and, when it was reversed, the reversing movement's id. */
    async get(orgId: string, id: string): Promise<Result<StockMovementDto, Code>> {
      const row = await repo.findMovement(orgId, id)
      if (!row) return fail({ error: Err.STOCK_MOVEMENT_NOT_FOUND, msg: message(Err.STOCK_MOVEMENT_NOT_FOUND) })
      const [lines, reversal] = await Promise.all([repo.findLines(orgId, id), repo.findReversalOf(orgId, id)])
      return ok({ data: toStockMovementDto(row, lines, reversal?.id ?? null), msg: "Stock movement retrieved successfully" })
    },

    /** Finds the movement a document posted (for "show the stock effect" and for reversing by document). */
    async getBySource(
      orgId: string,
      sourceType: string,
      sourceId: string
    ): Promise<Result<StockMovementDto, Code>> {
      const row = await repo.findBySource(orgId, sourceType, sourceId)
      if (!row) return fail({ error: Err.STOCK_MOVEMENT_NOT_FOUND, msg: message(Err.STOCK_MOVEMENT_NOT_FOUND) })
      const [lines, reversal] = await Promise.all([
        repo.findLines(orgId, row.id),
        repo.findReversalOf(orgId, row.id),
      ])
      return ok({ data: toStockMovementDto(row, lines, reversal?.id ?? null), msg: "Stock movement retrieved successfully" })
    },

    /**
     * Stock card: movement lines, newest first, for an item, a batch, a location or a warehouse
     * (either side), filtered by type and date. Offset pagination with total.
     */
    async listLines(
      orgId: string,
      query: StockMovementLineHistoryQuery
    ): Promise<Result<StockMovementLineHistoryResponse, Code>> {
      const { rows, total } = await repo.listLines(orgId, query)
      return ok({
        data: { items: rows.map(toHistoryItemDto), page: query.page, pageSize: query.pageSize, total },
        msg: "Stock movement history retrieved successfully",
      })
    },

    /** Quantity on hand per location, item and batch. Real warehouses and non-zero rows unless asked otherwise. */
    async listBalances(
      orgId: string,
      query: StockBalanceListQuery
    ): Promise<Result<StockBalanceListResponse, Code>> {
      const { rows, total } = await repo.listBalances(orgId, query)
      return ok({
        data: { items: rows.map(toStockBalanceDto), page: query.page, pageSize: query.pageSize, total },
        msg: "Stock balances retrieved successfully",
      })
    },

    /** On hand for several items at once (an item list column), optionally inside one warehouse. */
    async getOnHand(orgId: string, query: OnHandQuery): Promise<Result<OnHandResponse, Code>> {
      const rows = await repo.sumByItem(orgId, query.itemIds, { warehouseId: query.warehouseId })
      const byItem = new Map(rows.map((r) => [r.itemId, r.quantity]))
      return ok({
        data: { items: query.itemIds.map((itemId) => ({ itemId, quantity: byItem.get(itemId) ?? "0" })) },
        msg: "On hand quantities retrieved successfully",
      })
    },

    /** Where one item is: on hand in real warehouses, in transit, and the split per warehouse. */
    async getItemStock(orgId: string, itemId: string): Promise<Result<ItemStockDto, Code>> {
      const rows = await repo.sumByWarehouse(orgId, itemId)
      let onHand = "0"
      let inTransit = "0"
      for (const r of rows) {
        if (r.isSystem) inTransit = addDecimal(inTransit, r.quantity)
        else onHand = addDecimal(onHand, r.quantity)
      }
      return ok({ data: { itemId, onHand, inTransit, warehouses: rows }, msg: "Item stock retrieved successfully" })
    },

    /** How much of each batch of a batch-tracked item is on hand (real warehouses, non-zero only). */
    async getItemBatchStock(orgId: string, itemId: string): Promise<Result<ItemBatchStockDto, Code>> {
      const rows = await repo.sumByBatch(orgId, itemId)
      return ok({
        data: {
          itemId,
          batches: rows.flatMap((r) => (r.batchId ? [{ batchId: r.batchId, quantity: r.quantity }] : [])),
        },
        msg: "Item batch stock retrieved successfully",
      })
    },

    /* ---------- answers for the usage registry of other modules (INTERNAL, plain values) ---------- */

    /** Locations that hold stock or appear in history. Movements are never "open", other modules answer that. */
    async locationUsage(orgId: string, ids: readonly string[], tx?: Tx) {
      const u = await repo.locationUsage(orgId, ids, tx)
      return { withStock: u.withStock, withOpenDocuments: [] as string[], withHistory: u.withHistory }
    },

    async warehouseUsage(orgId: string, warehouseId: string, tx?: Tx) {
      const u = await repo.warehouseUsage(orgId, warehouseId, tx)
      return { hasStock: u.hasStock, hasOpenDocuments: false, isReferenced: u.hasHistory }
    },

    /** For the item module: an item that holds stock or was moved must keep its unit and tracking. */
    async itemUsage(orgId: string, itemId: string, tx?: Tx) {
      return repo.itemUsage(orgId, itemId, tx)
    },
  }
}
