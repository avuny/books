import {
  InventoryTransferErrorCode as Err,
  RoleErrorCode,
  inventoryTransferTranslationsEn,
  INVENTORY_TRANSFER_AUDIT_EVENTS as AUDIT,
  type CreateInventoryTransferInput,
  type InventoryTransferDto,
  type InventoryTransferOffsetListQuery,
  type InventoryTransferOffsetListResponse,
  type InventoryTransferOptionsQuery,
  type InventoryTransferOptionDto,
  type UpdateInventoryTransferInput,
  type DispatchInventoryTransferInput,
  type SettleInventoryTransferInput,
  type ReverseInventoryTransferInput,
  type ActivityLogAction,
} from "@avuny/contracts"
import { allocateBatches, addDecimal, compareDecimal, negateDecimal } from "@avuny/contracts"
import { INVENTORY_TRANSFER_SOURCE_TYPES } from "@avuny/contracts/inventory-transfer"
import { randomUUID } from "node:crypto"
import { fail, ok, type Result } from "@avuny/utils"
import { multiplyDecimal } from "../inventory-adjustment/inventory-adjustment.service.js"
import { toInventoryTransferDto, toInventoryTransferListItemDto } from "./inventory-transfer.mapper.js"
import { INVENTORY_TRANSFER_PERMISSIONS as P } from "./inventory-transfer.permissions.js"
import type { Code, InventoryTransferServiceDeps, NewLine } from "./inventory-transfer.types.js"

const message = (code: Err) =>
  (inventoryTransferTranslationsEn.errors as Record<string, string>)[code] ?? code

const LOCATION_ERRORS = {
  warehouse_not_found: Err.INVENTORY_TRANSFER_WAREHOUSE_NOT_FOUND,
  warehouse_not_physical: Err.INVENTORY_TRANSFER_WAREHOUSE_NOT_PHYSICAL,
  location_not_found: Err.INVENTORY_TRANSFER_LOCATION_NOT_FOUND,
  location_not_in_warehouse: Err.INVENTORY_TRANSFER_LOCATION_NOT_IN_WAREHOUSE,
  location_not_stockable: Err.INVENTORY_TRANSFER_LOCATION_NOT_STOCKABLE,
  location_blocked: Err.INVENTORY_TRANSFER_LOCATION_BLOCKED,
} as const

const ITEM_ERRORS = {
  item_not_found: Err.INVENTORY_TRANSFER_ITEM_NOT_FOUND,
  item_inactive: Err.INVENTORY_TRANSFER_ITEM_INACTIVE,
  item_not_stocked: Err.INVENTORY_TRANSFER_ITEM_NOT_STOCKED,
  unit_not_in_collection: Err.INVENTORY_TRANSFER_UNIT_NOT_IN_COLLECTION,
} as const

/** Thrown inside a posting transaction to roll everything back and report one code. */
class PostingAbort extends Error {
  constructor(readonly code: Err) {
    super(code)
  }
}

const sub = (a: string, b: string) => addDecimal(a, negateDecimal(b))

const pendingOf = (a: {
  dispatchedBaseQty: string
  receivedBaseQty: string
  lostBaseQty: string
  returnedBaseQty: string
}) => sub(sub(sub(a.dispatchedBaseQty, a.receivedBaseQty), a.lostBaseQty), a.returnedBaseQty)

/** Status follows the allocation counters, never the client. */
function deriveStatus(
  allocations: Array<{
    dispatchedBaseQty: string
    receivedBaseQty: string
    lostBaseQty: string
    returnedBaseQty: string
  }>
): "IN_TRANSIT" | "PARTIALLY_RECEIVED" | "RECEIVED" {
  const anyPending = allocations.some((a) => compareDecimal(pendingOf(a), "0") > 0)
  if (!anyPending) return "RECEIVED"
  const anyTouched = allocations.some(
    (a) =>
      compareDecimal(a.receivedBaseQty, "0") > 0 ||
      compareDecimal(a.lostBaseQty, "0") > 0 ||
      compareDecimal(a.returnedBaseQty, "0") > 0
  )
  return anyTouched ? "PARTIALLY_RECEIVED" : "IN_TRANSIT"
}

const postingFailure = (code: unknown): Err => {
  if (code === "STOCK_MOVEMENT_INSUFFICIENT_STOCK") return Err.INVENTORY_TRANSFER_INSUFFICIENT_STOCK
  if (code === "STOCK_MOVEMENT_BATCH_NOT_AVAILABLE") return Err.INVENTORY_TRANSFER_BATCH_NOT_AVAILABLE
  if (code === "STOCK_MOVEMENT_BATCH_NOT_FOUND") return Err.INVENTORY_TRANSFER_BATCH_NOT_FOUND
  if (code === "STOCK_MOVEMENT_ITEM_INACTIVE") return Err.INVENTORY_TRANSFER_ITEM_INACTIVE
  if (code === "STOCK_MOVEMENT_ITEM_NOT_STOCKED") return Err.INVENTORY_TRANSFER_ITEM_NOT_STOCKED
  return Err.INVENTORY_TRANSFER_POSTING_FAILED
}

type Step<T> = { ok: true; value: T } | { ok: false; error: Err }

export function createInventoryTransferService(deps: InventoryTransferServiceDeps) {
  const repo = deps.repository

  const can = (actorId: string, action: string, orgId: string, resourceId = orgId) =>
    deps.permissions.check({ userId: actorId }, action as any, { resourceId, orgId })

  const forbidden = () =>
    fail({
      error: RoleErrorCode.ROLE_PERMISSION_DENIED,
      msg: "You do not have permission to perform this action",
    })

  const audit = (orgId: string, actorId: string, action: string, resourceId: string) =>
    deps.activityLog.record({ orgId, actorId, action: action as ActivityLogAction, resourceId })

  /** Validates warehouses and lines and converts quantities to the item's base unit. */
  async function buildLines(
    orgId: string,
    sourceWarehouseId: string,
    destinationWarehouseId: string,
    input: CreateInventoryTransferInput["lines"],
    tx: Parameters<typeof deps.locations.validateLocation>[3]
  ): Promise<Step<NewLine[]>> {
    if (input.length === 0) return { ok: false, error: Err.INVENTORY_TRANSFER_NO_LINES }
    const seen = new Set<string>()
    for (const l of input) {
      const key = `${l.itemId}:${l.sourceLocationId}:${l.destinationLocationId}`
      if (seen.has(key)) return { ok: false, error: Err.INVENTORY_TRANSFER_DUPLICATE_LINES }
      seen.add(key)
    }
    const out: NewLine[] = []
    for (const l of input) {
      if (l.sourceLocationId === l.destinationLocationId) {
        return { ok: false, error: Err.INVENTORY_TRANSFER_SAME_LOCATION }
      }
      const src = await deps.locations.validateLocation(orgId, sourceWarehouseId, l.sourceLocationId, tx)
      if (!src.ok) return { ok: false, error: LOCATION_ERRORS[src.reason] }
      const dst = await deps.locations.validateLocation(orgId, destinationWarehouseId, l.destinationLocationId, tx)
      if (!dst.ok) return { ok: false, error: LOCATION_ERRORS[dst.reason] }

      const item = await deps.items.resolveUnitConversion(orgId, l.itemId, l.unitId, tx)
      if (!item.ok) return { ok: false, error: ITEM_ERRORS[item.reason] }

      const base = multiplyDecimal(l.quantity, item.factor)
      const [, frac = ""] = base.split(".")
      if (base.startsWith("-") || base === "0" || frac.length > 6 || base.replace(".", "").length > 18) {
        return { ok: false, error: Err.INVENTORY_TRANSFER_INVALID_QUANTITY }
      }
      out.push({
        lineNo: out.length + 1,
        itemId: l.itemId,
        sourceLocationId: l.sourceLocationId,
        destinationLocationId: l.destinationLocationId,
        unitId: l.unitId,
        baseUnitId: item.baseUnitId,
        requestedQty: l.quantity,
        requestedBaseQty: base,
        dispatchedBaseQty: "0",
        notes: l.notes ?? null,
      })
    }
    return { ok: true, value: out }
  }

  const detailDto = async (orgId: string, id: string, tx?: Parameters<typeof repo.findDetail>[2]) => {
    const d = await repo.findDetail(orgId, id, tx)
    return d ? toInventoryTransferDto(d) : null
  }

  return {
    async create(
      actorId: string,
      orgId: string,
      input: CreateInventoryTransferInput
    ): Promise<Result<InventoryTransferDto, Code>> {
      if (!(await can(actorId, P.CREATE, orgId))) return forbidden()

      const outcome = await repo.transaction(async (tx): Promise<Step<InventoryTransferDto>> => {
        const lines = await buildLines(
          orgId,
          input.sourceWarehouseId,
          input.destinationWarehouseId,
          input.lines,
          tx
        )
        if (!lines.ok) return lines

        const number = await repo.nextDocumentNumber(orgId, tx)
        const inserted = await repo.insertAggregate(
          orgId,
          {
            number,
            referenceNumber: input.referenceNumber ?? null,
            date: input.date,
            sourceWarehouseId: input.sourceWarehouseId,
            destinationWarehouseId: input.destinationWarehouseId,
            description: input.description ?? null,
            status: "DRAFT",
            createdBy: actorId,
          },
          lines.value,
          tx
        )
        if (!inserted.ok) return { ok: false, error: Err.INVENTORY_TRANSFER_NUMBER_TAKEN }
        const dto = await detailDto(orgId, inserted.row.id, tx)
        return dto ? { ok: true, value: dto } : { ok: false, error: Err.INVENTORY_TRANSFER_NOT_FOUND }
      })

      if (!outcome.ok) return fail({ error: outcome.error, msg: message(outcome.error) })
      await audit(orgId, actorId, AUDIT.CREATED, outcome.value.id)
      return ok({ data: outcome.value, msg: "Inventory transfer created successfully" })
    },

    async update(
      actorId: string,
      orgId: string,
      id: string,
      input: UpdateInventoryTransferInput
    ): Promise<Result<InventoryTransferDto, Code>> {
      if (!(await can(actorId, P.UPDATE, orgId, id))) return forbidden()

      const outcome = await repo.transaction(async (tx): Promise<Step<InventoryTransferDto>> => {
        const current = await repo.findAggregate(orgId, id, tx, { forUpdate: true })
        if (!current) return { ok: false, error: Err.INVENTORY_TRANSFER_NOT_FOUND }
        if (current.row.status !== "DRAFT") return { ok: false, error: Err.INVENTORY_TRANSFER_NOT_EDITABLE }

        const sourceWarehouseId = input.sourceWarehouseId ?? current.row.sourceWarehouseId
        const destinationWarehouseId = input.destinationWarehouseId ?? current.row.destinationWarehouseId
        const warehousesChanged =
          sourceWarehouseId !== current.row.sourceWarehouseId ||
          destinationWarehouseId !== current.row.destinationWarehouseId

        // Changing a warehouse without resending lines would leave lines in the wrong warehouse.
        const lineInput =
          input.lines ??
          (warehousesChanged
            ? current.lines.map((l) => ({
                itemId: l.itemId,
                sourceLocationId: l.sourceLocationId,
                destinationLocationId: l.destinationLocationId,
                unitId: l.unitId,
                quantity: l.requestedQty,
                notes: l.notes,
              }))
            : undefined)

        if (lineInput) {
          const lines = await buildLines(orgId, sourceWarehouseId, destinationWarehouseId, lineInput, tx)
          if (!lines.ok) return lines
          await repo.replaceLines(orgId, id, lines.value, tx)
        }

        const patch: Record<string, unknown> = {}
        if (input.referenceNumber !== undefined) patch.referenceNumber = input.referenceNumber
        if (input.date !== undefined) patch.date = input.date
        if (input.sourceWarehouseId !== undefined) patch.sourceWarehouseId = input.sourceWarehouseId
        if (input.destinationWarehouseId !== undefined) patch.destinationWarehouseId = input.destinationWarehouseId
        if (input.description !== undefined) patch.description = input.description
        const updated = await repo.updateAggregate(orgId, id, patch, tx)
        if (!updated) return { ok: false, error: Err.INVENTORY_TRANSFER_NOT_FOUND }
        const dto = await detailDto(orgId, id, tx)
        return dto ? { ok: true, value: dto } : { ok: false, error: Err.INVENTORY_TRANSFER_NOT_FOUND }
      })

      if (!outcome.ok) return fail({ error: outcome.error, msg: message(outcome.error) })
      await audit(orgId, actorId, AUDIT.UPDATED, id)
      return ok({ data: outcome.value, msg: "Inventory transfer updated successfully" })
    },

    async delete(actorId: string, orgId: string, id: string): Promise<Result<{ id: string }, Code>> {
      if (!(await can(actorId, P.DELETE, orgId, id))) return forbidden()

      const outcome = await repo.transaction(async (tx): Promise<Step<{ id: string }>> => {
        const current = await repo.findAggregate(orgId, id, tx, { forUpdate: true })
        if (!current) return { ok: false, error: Err.INVENTORY_TRANSFER_NOT_FOUND }
        if (current.row.status !== "DRAFT") return { ok: false, error: Err.INVENTORY_TRANSFER_NOT_DELETABLE }
        const deleted = await repo.delete(orgId, id, tx)
        if (!deleted.ok) return { ok: false, error: Err.INVENTORY_TRANSFER_NOT_FOUND }
        return { ok: true, value: { id } }
      })

      if (!outcome.ok) return fail({ error: outcome.error, msg: message(outcome.error) })
      await audit(orgId, actorId, AUDIT.DELETED, id)
      return ok({ data: { id }, msg: "Inventory transfer deleted successfully" })
    },

    /** Cancels a draft. Cancelling after dispatch is a return or write-off (later phases). */
    async cancel(actorId: string, orgId: string, id: string): Promise<Result<InventoryTransferDto, Code>> {
      if (!(await can(actorId, P.CANCEL, orgId, id))) return forbidden()

      const outcome = await repo.transaction(async (tx): Promise<Step<InventoryTransferDto>> => {
        const current = await repo.findAggregate(orgId, id, tx, { forUpdate: true })
        if (!current) return { ok: false, error: Err.INVENTORY_TRANSFER_NOT_FOUND }
        if (current.row.status === "CANCELLED") return { ok: false, error: Err.INVENTORY_TRANSFER_ALREADY_CANCELLED }
        if (current.row.status !== "DRAFT") return { ok: false, error: Err.INVENTORY_TRANSFER_NOT_DRAFT }
        await repo.updateAggregate(orgId, id, { status: "CANCELLED" }, tx)
        const dto = await detailDto(orgId, id, tx)
        return dto ? { ok: true, value: dto } : { ok: false, error: Err.INVENTORY_TRANSFER_NOT_FOUND }
      })

      if (!outcome.ok) return fail({ error: outcome.error, msg: message(outcome.error) })
      await audit(orgId, actorId, AUDIT.CANCELLED, id)
      return ok({ data: outcome.value, msg: "Inventory transfer cancelled successfully" })
    },

    /**
     * DRAFT -> IN_TRANSIT. One `transfer` movement from each source location to IN-TRANSIT, with the
     * batches chosen here (FEFO for expiry items, FIFO otherwise) so partial receiving works per batch.
     * Lines may be lowered (never raised); a line lowered to 0 is dropped.
     */
    async dispatch(
      actorId: string,
      orgId: string,
      id: string,
      input: DispatchInventoryTransferInput = {}
    ): Promise<Result<InventoryTransferDto, Code>> {
      if (!(await can(actorId, P.DISPATCH, orgId, id))) return forbidden()

      let outcome: Step<InventoryTransferDto>
      try {
        outcome = await repo.transaction(async (tx): Promise<Step<InventoryTransferDto>> => {
          const current = await repo.findAggregate(orgId, id, tx, { forUpdate: true })
          if (!current) throw new PostingAbort(Err.INVENTORY_TRANSFER_NOT_FOUND)
          const { row } = current
          if (row.status === "CANCELLED") throw new PostingAbort(Err.INVENTORY_TRANSFER_NOT_DISPATCHABLE)
          if (row.status !== "DRAFT") throw new PostingAbort(Err.INVENTORY_TRANSFER_ALREADY_DISPATCHED)

          // 1. quantities to send per line
          const override = new Map<string, string>()
          for (const l of input.lines ?? []) {
            if (!current.lines.some((x) => x.id === l.lineId)) throw new PostingAbort(Err.INVENTORY_TRANSFER_LINE_NOT_FOUND)
            override.set(l.lineId, l.baseQuantity)
          }
          const plan: Array<{ line: (typeof current.lines)[number]; qty: string }> = []
          for (const line of current.lines) {
            const qty = override.get(line.id) ?? line.requestedBaseQty
            if (compareDecimal(qty, "0") < 0) throw new PostingAbort(Err.INVENTORY_TRANSFER_INVALID_QUANTITY)
            if (compareDecimal(qty, line.requestedBaseQty) > 0) throw new PostingAbort(Err.INVENTORY_TRANSFER_EXCEEDS_REQUESTED)
            plan.push({ line, qty })
          }
          const sending = plan.filter((p) => compareDecimal(p.qty, "0") > 0)
          if (sending.length === 0) throw new PostingAbort(Err.INVENTORY_TRANSFER_NO_LINES)

          // 2. locations are still good, source pickable, destination receivable
          for (const { line } of sending) {
            const src = await deps.locations.validateLocation(orgId, row.sourceWarehouseId, line.sourceLocationId, tx)
            if (!src.ok) throw new PostingAbort(LOCATION_ERRORS[src.reason])
            const dst = await deps.locations.validateLocation(orgId, row.destinationWarehouseId, line.destinationLocationId, tx)
            if (!dst.ok) throw new PostingAbort(LOCATION_ERRORS[dst.reason])
            const pick = await deps.locations.assertIntent(orgId, line.sourceLocationId, "issue", tx)
            if (!pick.ok) throw new PostingAbort(pick.reason === "blocked" ? Err.INVENTORY_TRANSFER_LOCATION_BLOCKED : Err.INVENTORY_TRANSFER_LOCATION_NOT_PICKABLE)
            const recv = await deps.locations.assertIntent(orgId, line.destinationLocationId, "receive", tx)
            if (!recv.ok) throw new PostingAbort(recv.reason === "blocked" ? Err.INVENTORY_TRANSFER_LOCATION_BLOCKED : Err.INVENTORY_TRANSFER_LOCATION_NOT_RECEIVABLE)
          }

          const transitId = await deps.stock.transitLocationId(orgId, tx)
          if (!transitId) throw new PostingAbort(Err.INVENTORY_TRANSFER_POSTING_FAILED)

          // 3. batch allocation, one movement line per (line, batch)
          const claimed = new Map<string, string>()
          const parts: Array<{ lineId: string; itemId: string; batchId: string | null; quantity: string; fromLocationId: string }> = []
          for (const { line, qty } of sending) {
            const policy = await deps.items.findPolicy(orgId, line.itemId, tx)
            if (!policy) throw new PostingAbort(Err.INVENTORY_TRANSFER_ITEM_NOT_FOUND)
            if (!policy.isBatchTracked) {
              parts.push({ lineId: line.id, itemId: line.itemId, batchId: null, quantity: qty, fromLocationId: line.sourceLocationId })
              continue
            }
            const pool = await deps.stock.listAllocatable(orgId, line.itemId, line.sourceLocationId, tx)
            const left = pool.map((b) => ({
              ...b,
              available: sub(b.available, claimed.get(`${line.sourceLocationId}:${b.batchId}`) ?? "0"),
            }))
            const res = allocateBatches(qty, left, policy.isExpiryTracked ? "fefo" : "fifo")
            if (!res.ok) throw new PostingAbort(Err.INVENTORY_TRANSFER_INSUFFICIENT_STOCK)
            for (const part of res.lines) {
              const key = `${line.sourceLocationId}:${part.batchId}`
              claimed.set(key, addDecimal(claimed.get(key) ?? "0", part.quantity))
              parts.push({ lineId: line.id, itemId: line.itemId, batchId: part.batchId, quantity: part.quantity, fromLocationId: line.sourceLocationId })
            }
          }

          // 4. post the movement
          const moved = await deps.stock.post(
            actorId,
            orgId,
            {
              type: "transfer",
              sourceType: INVENTORY_TRANSFER_SOURCE_TYPES.DISPATCH,
              sourceId: row.id,
              sourceRef: row.number,
              lines: parts.map((p) => ({
                itemId: p.itemId,
                batchId: p.batchId ?? undefined,
                fromLocationId: p.fromLocationId,
                toLocationId: transitId,
                quantity: p.quantity,
              })),
            },
            tx
          )
          if (!moved.success) throw new PostingAbort(postingFailure((moved as any).error))
          const posted = [...moved.data.lines].sort((a, b) => a.lineNo - b.lineNo)
          if (posted.length !== parts.length) throw new PostingAbort(Err.INVENTORY_TRANSFER_POSTING_FAILED)

          // 5. document: allocations, dispatched quantities, dropped lines, status
          await repo.insertAllocations(
            orgId,
            parts.map((p, i) => ({
              lineId: p.lineId,
              itemId: p.itemId,
              batchId: p.batchId,
              dispatchedBaseQty: p.quantity,
              dispatchMovementLineId: posted[i]!.id,
            })),
            tx
          )
          for (const { line, qty } of plan) {
            if (compareDecimal(qty, "0") === 0) await repo.deleteLine(orgId, line.id, tx)
            else await repo.updateLineDispatched(orgId, line.id, qty, tx)
          }
          await repo.updateAggregate(
            orgId,
            id,
            {
              status: "IN_TRANSIT",
              dispatchedAt: new Date(),
              dispatchedBy: actorId,
              dispatchStockMovementId: moved.data.id,
            },
            tx
          )
          const dto = await detailDto(orgId, id, tx)
          return dto ? { ok: true, value: dto } : { ok: false, error: Err.INVENTORY_TRANSFER_NOT_FOUND }
        })
      } catch (err) {
        if (err instanceof PostingAbort) return fail({ error: err.code, msg: message(err.code) })
        throw err
      }

      if (!outcome.ok) return fail({ error: outcome.error, msg: message(outcome.error) })
      await audit(orgId, actorId, AUDIT.DISPATCHED, id)
      return ok({ data: outcome.value, msg: "Inventory transfer dispatched successfully" })
    },

    /** Sends what is still in transit back to the source locations (all of it, or the chosen allocations). */
    async returnToSource(
      actorId: string,
      orgId: string,
      id: string,
      input: SettleInventoryTransferInput = {}
    ): Promise<Result<InventoryTransferDto, Code>> {
      if (!(await can(actorId, P.RETURN, orgId, id))) return forbidden()

      let outcome: Step<InventoryTransferDto>
      try {
        outcome = await repo.transaction(async (tx): Promise<Step<InventoryTransferDto>> => {
          const current = await repo.findAggregate(orgId, id, tx, { forUpdate: true })
          if (!current) throw new PostingAbort(Err.INVENTORY_TRANSFER_NOT_FOUND)
          if (current.row.status !== "IN_TRANSIT" && current.row.status !== "PARTIALLY_RECEIVED") {
            throw new PostingAbort(Err.INVENTORY_TRANSFER_NOT_IN_TRANSIT)
          }
          const allocations = await repo.findAllocations(orgId, id, tx, { forUpdate: true })
          const lineOf = new Map(current.lines.map((l) => [l.id, l]))

          const chosen = new Map<string, string>()
          if (input.lines) {
            for (const l of input.lines) {
              if (!allocations.some((a) => a.id === l.allocationId)) throw new PostingAbort(Err.INVENTORY_TRANSFER_ALLOCATION_NOT_FOUND)
              if (compareDecimal(l.baseQuantity, "0") <= 0) throw new PostingAbort(Err.INVENTORY_TRANSFER_INVALID_QUANTITY)
              chosen.set(l.allocationId, l.baseQuantity)
            }
          } else {
            for (const a of allocations) if (compareDecimal(pendingOf(a), "0") > 0) chosen.set(a.id, pendingOf(a))
          }
          if (chosen.size === 0) throw new PostingAbort(Err.INVENTORY_TRANSFER_NOTHING_PENDING)

          const parts: Array<{ a: (typeof allocations)[number]; qty: string; toLocationId: string }> = []
          for (const a of allocations) {
            const qty = chosen.get(a.id)
            if (qty === undefined) continue
            if (compareDecimal(qty, pendingOf(a)) > 0) throw new PostingAbort(Err.INVENTORY_TRANSFER_EXCEEDS_PENDING)
            const line = lineOf.get(a.lineId)
            if (!line) throw new PostingAbort(Err.INVENTORY_TRANSFER_LINE_NOT_FOUND)
            parts.push({ a, qty, toLocationId: line.sourceLocationId })
          }

          const transitId = await deps.stock.transitLocationId(orgId, tx)
          if (!transitId) throw new PostingAbort(Err.INVENTORY_TRANSFER_POSTING_FAILED)
          const eventId = randomUUID()
          const moved = await deps.stock.post(
            actorId,
            orgId,
            {
              type: "transfer",
              sourceType: INVENTORY_TRANSFER_SOURCE_TYPES.RETURN,
              sourceId: eventId,
              sourceRef: current.row.number,
              lines: parts.map((p) => ({
                itemId: p.a.itemId,
                batchId: p.a.batchId ?? undefined,
                fromLocationId: transitId,
                toLocationId: p.toLocationId,
                quantity: p.qty,
              })),
            },
            tx
          )
          if (!moved.success) throw new PostingAbort(postingFailure((moved as any).error))
          const posted = [...moved.data.lines].sort((a, b) => a.lineNo - b.lineNo)
          if (posted.length !== parts.length) throw new PostingAbort(Err.INVENTORY_TRANSFER_POSTING_FAILED)

          const eventNo = await repo.nextEventNo(orgId, id, tx)
          await repo.insertEvent(
            orgId,
            {
              id: eventId,
              transferId: id,
              eventNo,
              kind: "RETURN",
              occurredAt: new Date(),
              note: input.note ?? null,
              stockMovementId: moved.data.id,
              createdBy: actorId,
            },
            parts.map((p, i) => ({
              allocationId: p.a.id,
              destinationLocationId: p.toLocationId,
              baseQuantity: p.qty,
              stockMovementLineId: posted[i]!.id,
            })),
            tx
          )
          const updated = allocations.map((a) => ({ ...a }))
          for (const p of parts) {
            const next = addDecimal(p.a.returnedBaseQty, p.qty)
            await repo.updateAllocationCounters(orgId, p.a.id, { returnedBaseQty: next }, tx)
            const u = updated.find((x) => x.id === p.a.id)!
            u.returnedBaseQty = next
          }
          await repo.updateAggregate(orgId, id, { status: deriveStatus(updated) }, tx)
          const dto = await detailDto(orgId, id, tx)
          return dto ? { ok: true, value: dto } : { ok: false, error: Err.INVENTORY_TRANSFER_NOT_FOUND }
        })
      } catch (err) {
        if (err instanceof PostingAbort) return fail({ error: err.code, msg: message(err.code) })
        throw err
      }

      if (!outcome.ok) return fail({ error: outcome.error, msg: message(outcome.error) })
      await audit(orgId, actorId, AUDIT.RETURNED, id)
      return ok({ data: outcome.value, msg: "Inventory transfer returned to source successfully" })
    },

    /** Undoes a dispatch while nothing was received, lost or returned. The transfer ends CANCELLED. */
    async reverseDispatch(
      actorId: string,
      orgId: string,
      id: string,
      input: ReverseInventoryTransferInput = {}
    ): Promise<Result<InventoryTransferDto, Code>> {
      if (!(await can(actorId, P.REVERSE, orgId, id))) return forbidden()

      let outcome: Step<InventoryTransferDto>
      try {
        outcome = await repo.transaction(async (tx): Promise<Step<InventoryTransferDto>> => {
          const current = await repo.findAggregate(orgId, id, tx, { forUpdate: true })
          if (!current) throw new PostingAbort(Err.INVENTORY_TRANSFER_NOT_FOUND)
          if (current.row.status === "CANCELLED") throw new PostingAbort(Err.INVENTORY_TRANSFER_ALREADY_CANCELLED)
          if (current.row.status !== "IN_TRANSIT" || !current.row.dispatchStockMovementId) {
            throw new PostingAbort(Err.INVENTORY_TRANSFER_CANNOT_REVERSE)
          }
          const allocations = await repo.findAllocations(orgId, id, tx, { forUpdate: true })
          const touched = allocations.some(
            (a) =>
              compareDecimal(a.receivedBaseQty, "0") > 0 ||
              compareDecimal(a.lostBaseQty, "0") > 0 ||
              compareDecimal(a.returnedBaseQty, "0") > 0
          )
          if (touched) throw new PostingAbort(Err.INVENTORY_TRANSFER_CANNOT_REVERSE)

          const reversed = await deps.stock.reverse(
            actorId,
            orgId,
            current.row.dispatchStockMovementId,
            { note: input.note ?? `Reversal of ${current.row.number}` },
            tx
          )
          if (!reversed.success) throw new PostingAbort(postingFailure((reversed as any).error))
          // Everything went back to the source: record it in the counters so they still add up.
          for (const a of allocations) {
            await repo.updateAllocationCounters(orgId, a.id, { returnedBaseQty: a.dispatchedBaseQty }, tx)
          }
          await repo.updateAggregate(orgId, id, { status: "CANCELLED" }, tx)
          const dto = await detailDto(orgId, id, tx)
          return dto ? { ok: true, value: dto } : { ok: false, error: Err.INVENTORY_TRANSFER_NOT_FOUND }
        })
      } catch (err) {
        if (err instanceof PostingAbort) return fail({ error: err.code, msg: message(err.code) })
        throw err
      }

      if (!outcome.ok) return fail({ error: outcome.error, msg: message(outcome.error) })
      await audit(orgId, actorId, AUDIT.REVERSED, id)
      return ok({ data: outcome.value, msg: "Inventory transfer dispatch reversed successfully" })
    },

    async get(actorId: string, orgId: string, id: string): Promise<Result<InventoryTransferDto, Code>> {
      if (!(await can(actorId, P.READ, orgId, id))) return forbidden()
      const dto = await detailDto(orgId, id)
      if (!dto) return fail({ error: Err.INVENTORY_TRANSFER_NOT_FOUND, msg: message(Err.INVENTORY_TRANSFER_NOT_FOUND) })
      return ok({ data: dto, msg: "Inventory transfer retrieved successfully" })
    },

    async list(
      actorId: string,
      orgId: string,
      query: InventoryTransferOffsetListQuery
    ): Promise<Result<InventoryTransferOffsetListResponse, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      const { rows, total } = await repo.list(orgId, {
        page: query.page,
        pageSize: query.pageSize,
        search: query.search || undefined,
        sourceWarehouseId: query.sourceWarehouseId,
        destinationWarehouseId: query.destinationWarehouseId,
        status: query.status,
        fromDate: query.fromDate,
        toDate: query.toDate,
      })
      return ok({
        data: { items: rows.map(toInventoryTransferListItemDto), page: query.page, pageSize: query.pageSize, total },
        msg: "Inventory transfers retrieved successfully",
      })
    },

    async listOptions(
      actorId: string,
      orgId: string,
      query: InventoryTransferOptionsQuery
    ): Promise<Result<{ items: InventoryTransferOptionDto[] }, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      const rows = await repo.listOptions(orgId, { search: query.search, status: query.status, limit: query.limit })
      return ok({
        data: { items: rows as InventoryTransferOptionDto[] },
        msg: "Inventory transfer options retrieved successfully",
      })
    },
  }
}

export type InventoryTransferService = ReturnType<typeof createInventoryTransferService>
