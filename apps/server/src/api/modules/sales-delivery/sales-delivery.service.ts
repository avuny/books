import {
  SALES_DELIVERY_AUDIT_EVENTS,
  SALES_DELIVERY_NUMBER_PAD,
  SALES_DELIVERY_NUMBER_PREFIX,
  SALES_DELIVERY_SOURCE_TYPE,
  SALES_ORDER_OPEN_STATUSES,
  SALES_ORDER_RESERVATION_SOURCE_TYPE,
  SalesDeliveryErrorCode as Err,
  RoleErrorCode,
  addQty,
  cmpQty,
  isPositiveQty,
  mulQty,
  openToDeliverBaseQty,
  salesDeliveryTranslationsEn,
  subQty,
  type ActivityLogAction,
  type CreateSalesDeliveryInput,
  type ReverseSalesDeliveryInput,
  type SalesDeliveryDto,
  type SalesDeliveryLineInput,
  type SalesDeliveryListResponse,
  type UpdateSalesDeliveryInput,
} from "@avuny/contracts"
import type { SalesOrder, SalesOrderLine, Tx } from "@avuny/db"
import { fail, ok, type Result } from "@avuny/utils"
import { toSalesDeliveryDto } from "./sales-delivery.mapper.js"
import { SALES_DELIVERY_PERMISSIONS as P } from "./sales-delivery.permissions.js"
import type { Code, NewDeliveryLine, SalesDeliveryServiceDeps } from "./sales-delivery.types.js"

const message = (code: Err) => salesDeliveryTranslationsEn.errors[code]
const failWith = (code: Err) => fail({ error: code, msg: message(code) })

/** Thrown inside a posting transaction to roll everything back and report one code. */
class PostingAbort extends Error {
  constructor(readonly code: Err) {
    super(code)
  }
}

export const formatSalesDeliveryNumber = (seq: number) =>
  `${SALES_DELIVERY_NUMBER_PREFIX}${String(seq).padStart(SALES_DELIVERY_NUMBER_PAD, "0")}`

const isOpen = (status: SalesOrder["status"]) => (SALES_ORDER_OPEN_STATUSES as readonly string[]).includes(status)
/** A delivery can be reversed while the order is confirmed or already closed, never after cancellation. */
const canReverseOn = (status: SalesOrder["status"]) => isOpen(status) || status === "CLOSED"


export function createSalesDeliveryService(deps: SalesDeliveryServiceDeps) {
  const repo = deps.repository

  const can = (actorId: string, action: (typeof P)[keyof typeof P], orgId: string) =>
    deps.permissions.check({ userId: actorId }, action, { resourceId: orgId, orgId })

  const forbidden = () =>
    fail({ error: RoleErrorCode.ROLE_PERMISSION_DENIED, msg: "You do not have permission to perform this action" })

  const audit = (orgId: string, actorId: string, action: string, resourceId: string, metadata?: Record<string, unknown>) =>
    deps.activityLog.record({ orgId, actorId, action: action as ActivityLogAction, resourceId, metadata })

  const loadDto = async (orgId: string, id: string, tx?: Tx): Promise<Result<SalesDeliveryDto, Code>> => {
    const detail = await repo.findDetail(orgId, id, tx)
    if (!detail) return failWith(Err.SALES_DELIVERY_NOT_FOUND)
    return ok({ data: toSalesDeliveryDto(detail.row, detail.lines) })
  }

  /** Turns request lines into draft rows. Shared by create and update. */
  const buildLines = async (
    orgId: string,
    orderLines: readonly SalesOrderLine[],
    inputs: readonly SalesDeliveryLineInput[]
  ): Promise<Result<NewDeliveryLine[], Code>> => {
    const seen = new Set<string>()
    const built: NewDeliveryLine[] = []
    for (const [i, input] of inputs.entries()) {
      const ol = orderLines.find((l) => l.id === input.salesOrderLineId)
      if (!ol) return failWith(Err.SALES_DELIVERY_LINE_NOT_ON_ORDER)
      if (seen.has(ol.id)) return failWith(Err.SALES_DELIVERY_DUPLICATE_LINES)
      seen.add(ol.id)
      if (!isPositiveQty(input.quantity)) return failWith(Err.SALES_DELIVERY_QUANTITY_NOT_POSITIVE)

      const unitId = input.unitId ?? ol.unitId
      let factor = ol.baseUnitFactorSnapshot
      if (unitId !== ol.unitId) {
        const unit = await deps.items.resolve(orgId, ol.itemId, unitId)
        if (!unit.ok) return failWith(Err.SALES_DELIVERY_UNIT_NOT_IN_COLLECTION)
        factor = unit.factor
      }
      const baseQuantity = mulQty(input.quantity, factor)
      if (cmpQty(baseQuantity, openToDeliverBaseQty(ol)) > 0) return failWith(Err.SALES_DELIVERY_EXCEEDS_OPEN)

      const locationId = input.locationId ?? ol.locationId
      const location = await deps.locations.validate(orgId, ol.warehouseId, locationId)
      if (!location.ok) return failWith(Err.SALES_DELIVERY_LOCATION_INVALID)

      built.push({
        lineNo: i + 1,
        salesOrderLineId: ol.id,
        itemId: ol.itemId,
        descriptionSnapshot: ol.descriptionSnapshot ?? null,
        warehouseId: ol.warehouseId,
        locationId,
        unitId,
        baseUnitFactorSnapshot: factor,
        quantity: input.quantity,
        baseQuantity,
        costAmount: 0,
        notes: input.notes ?? null,
      })
    }
    return ok({ data: built })
  }

  return {
    async createForOrder(
      actorId: string,
      orgId: string,
      salesOrderId: string,
      input: CreateSalesDeliveryInput
    ): Promise<Result<SalesDeliveryDto, Code>> {
      if (!(await can(actorId, P.CREATE, orgId))) return forbidden()
      const order = await deps.orders.findAggregate(orgId, salesOrderId)
      if (!order) return failWith(Err.SALES_DELIVERY_SALES_ORDER_NOT_FOUND)
      if (!isOpen(order.row.status)) return failWith(Err.SALES_DELIVERY_SALES_ORDER_NOT_OPEN)
      if (input.lines.length === 0) return failWith(Err.SALES_DELIVERY_NO_LINES)
      const built = await buildLines(orgId, order.lines, input.lines)
      if (!built.success) return built

      let createdId: string | null = null
      for (let attempt = 0; attempt < 5 && !createdId; attempt++) {
        const inserted = await repo.insertAggregate(
          orgId,
          {
            number: formatSalesDeliveryNumber((await repo.maxNumberSuffix(orgId)) + 1),
            salesOrderId,
            partyId: order.row.partyId,
            deliveryDate: input.deliveryDate,
            carrier: input.carrier ?? null,
            trackingNumber: input.trackingNumber ?? null,
            notes: input.notes ?? null,
            status: "DRAFT",
            currency: order.row.currency,
            totalCost: 0,
            createdBy: actorId,
          },
          built.data
        )
        if (inserted.ok) createdId = inserted.row.id
      }
      if (!createdId) return failWith(Err.SALES_DELIVERY_NUMBER_TAKEN)
      await audit(orgId, actorId, SALES_DELIVERY_AUDIT_EVENTS.CREATED, createdId)
      return loadDto(orgId, createdId)
    },

    async listByOrder(
      actorId: string,
      orgId: string,
      salesOrderId: string
    ): Promise<Result<SalesDeliveryListResponse, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      if (!(await deps.orders.findAggregate(orgId, salesOrderId))) {
        return failWith(Err.SALES_DELIVERY_SALES_ORDER_NOT_FOUND)
      }
      const rows = await repo.listByOrder(orgId, salesOrderId)
      return ok({ data: { items: rows.map((r) => toSalesDeliveryDto(r.row, r.lines)) } })
    },

    async get(actorId: string, orgId: string, id: string): Promise<Result<SalesDeliveryDto, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      return loadDto(orgId, id)
    },

    async update(
      actorId: string,
      orgId: string,
      id: string,
      input: UpdateSalesDeliveryInput
    ): Promise<Result<SalesDeliveryDto, Code>> {
      if (!(await can(actorId, P.UPDATE, orgId))) return forbidden()
      const current = await repo.findAggregate(orgId, id)
      if (!current) return failWith(Err.SALES_DELIVERY_NOT_FOUND)
      if (current.row.status !== "DRAFT") return failWith(Err.SALES_DELIVERY_NOT_EDITABLE)

      let newLines: NewDeliveryLine[] | null = null
      if (input.lines) {
        const order = await deps.orders.findAggregate(orgId, current.row.salesOrderId)
        if (!order) return failWith(Err.SALES_DELIVERY_SALES_ORDER_NOT_FOUND)
        if (!isOpen(order.row.status)) return failWith(Err.SALES_DELIVERY_SALES_ORDER_NOT_OPEN)
        const built = await buildLines(orgId, order.lines, input.lines)
        if (!built.success) return built
        newLines = built.data
      }
      const patch: Parameters<typeof repo.updateHeader>[2] = {}
      if (input.deliveryDate) patch.deliveryDate = input.deliveryDate
      if (input.carrier !== undefined) patch.carrier = input.carrier
      if (input.trackingNumber !== undefined) patch.trackingNumber = input.trackingNumber
      if (input.notes !== undefined) patch.notes = input.notes

      await repo.transaction(async (tx) => {
        if (Object.keys(patch).length > 0) await repo.updateHeader(orgId, id, patch, tx)
        if (newLines) await repo.replaceLines(orgId, id, newLines, tx)
      })
      await audit(orgId, actorId, SALES_DELIVERY_AUDIT_EVENTS.UPDATED, id)
      return loadDto(orgId, id)
    },

    async delete(actorId: string, orgId: string, id: string): Promise<Result<{ id: string }, Code>> {
      if (!(await can(actorId, P.DELETE, orgId))) return forbidden()
      const current = await repo.findAggregate(orgId, id)
      if (!current) return failWith(Err.SALES_DELIVERY_NOT_FOUND)
      if (current.row.status !== "DRAFT") return failWith(Err.SALES_DELIVERY_NOT_DELETABLE)
      await repo.deleteById(orgId, id)
      await audit(orgId, actorId, SALES_DELIVERY_AUDIT_EVENTS.DELETED, id)
      return ok({ data: { id } })
    },

    /**
     * DRAFT -> POSTED, atomically (SPEC 8.4): the order's reservation is consumed, stock goes out to the customer
     * (sale movement), FIFO cost layers are consumed, Dr cost of goods sold / Cr inventory is journaled at the cost
     * actually taken from the layers, and the order line counters move. Quantity above the active reservation
     * is delivered only from free stock, so another order's reservation is never taken.
     */
    async post(actorId: string, orgId: string, id: string): Promise<Result<SalesDeliveryDto, Code>> {
      if (!(await can(actorId, P.POST, orgId))) return forbidden()

      try {
        await repo.transaction(async (tx) => {
          const current = await repo.findAggregate(orgId, id, tx)
          if (!current) throw new PostingAbort(Err.SALES_DELIVERY_NOT_FOUND)
          if (current.row.status === "POSTED") throw new PostingAbort(Err.SALES_DELIVERY_ALREADY_POSTED)
          if (current.row.status !== "DRAFT") throw new PostingAbort(Err.SALES_DELIVERY_NOT_POSTED)
          if (current.lines.length === 0) throw new PostingAbort(Err.SALES_DELIVERY_NO_LINES)

          const order = await deps.orders.findAggregate(orgId, current.row.salesOrderId, tx)
          if (!order) throw new PostingAbort(Err.SALES_DELIVERY_SALES_ORDER_NOT_FOUND)
          if (!isOpen(order.row.status)) throw new PostingAbort(Err.SALES_DELIVERY_SALES_ORDER_NOT_OPEN)
          if (order.row.partyId !== current.row.partyId) throw new PostingAbort(Err.SALES_DELIVERY_LINE_NOT_ON_ORDER)
          const orderLines = new Map((await deps.orders.lockLines(orgId, order.row.id, tx)).map((l) => [l.id, l]))

          // Re-check against the counters as they are now: another delivery may have posted since the draft.
          const need = new Map<string, string>()
          for (const dl of current.lines) {
            const ol = orderLines.get(dl.salesOrderLineId)
            if (!ol) throw new PostingAbort(Err.SALES_DELIVERY_LINE_NOT_ON_ORDER)
            if (cmpQty(dl.baseQuantity, openToDeliverBaseQty(ol)) > 0) throw new PostingAbort(Err.SALES_DELIVERY_EXCEEDS_OPEN)
            need.set(dl.id, dl.baseQuantity)
          }

          // Free stock before the reservation is consumed, so the unreserved part cannot eat other reservations.
          const free = new Map<string, string>()
          for (const dl of current.lines) {
            const key = `${dl.itemId}:${dl.locationId}`
            if (!free.has(key)) free.set(key, await deps.reservations.freeQty(orgId, dl.itemId, dl.locationId, tx))
          }

          // Only lines delivered from the location they were reserved at can consume the reservation.
          const reservable = current.lines.filter((dl) => orderLines.get(dl.salesOrderLineId)!.locationId === dl.locationId)
          const picks = await deps.reservations.consume(
            orgId,
            SALES_ORDER_RESERVATION_SOURCE_TYPE,
            order.row.id,
            reservable.map((dl) => ({ sourceLineId: dl.salesOrderLineId, baseQty: dl.baseQuantity })),
            tx
          )

          // One stock line per consumed slice (batch) plus one for any unreserved remainder.
          const movementInputs: { lineId: string; itemId: string; batchId: string | null; locationId: string; qty: string }[] = []
          const consumedByLine = new Map<string, string>()
          for (const dl of current.lines) {
            let consumed = "0"
            for (const p of picks.filter((x) => x.sourceLineId === dl.salesOrderLineId && reservable.includes(dl))) {
              movementInputs.push({ lineId: dl.id, itemId: dl.itemId, batchId: p.batchId, locationId: dl.locationId, qty: p.baseQty })
              consumed = addQty(consumed, p.baseQty)
            }
            consumedByLine.set(dl.id, consumed)
            const remainder = subQty(dl.baseQuantity, consumed)
            if (isPositiveQty(remainder)) {
              const key = `${dl.itemId}:${dl.locationId}`
              const left = free.get(key) ?? "0"
              if (cmpQty(remainder, left) > 0) throw new PostingAbort(Err.SALES_DELIVERY_INSUFFICIENT_STOCK)
              free.set(key, subQty(left, remainder))
              movementInputs.push({ lineId: dl.id, itemId: dl.itemId, batchId: null, locationId: dl.locationId, qty: remainder })
            }
          }

          const moved = await deps.stockMovement.post(
            actorId,
            orgId,
            {
              type: "sale",
              sourceType: SALES_DELIVERY_SOURCE_TYPE,
              sourceId: current.row.id,
              sourceRef: current.row.number,
              lines: movementInputs.map((m) => ({
                itemId: m.itemId,
                batchId: m.batchId ?? undefined,
                fromLocationId: m.locationId,
                quantity: m.qty,
              })),
            },
            tx
          )
          if (!moved.success) {
            throw new PostingAbort(
              moved.error === "STOCK_MOVEMENT_INSUFFICIENT_STOCK"
                ? Err.SALES_DELIVERY_INSUFFICIENT_STOCK
                : Err.SALES_DELIVERY_POSTING_FAILED
            )
          }
          const postedLines = [...moved.data.lines].sort((a, b) => a.lineNo - b.lineNo)

          // Walk the posted lines in order. A line that was split by FEFO still sums to what was asked.
          const costByDeliveryLine = new Map<string, number>()
          let cursor = 0
          for (const m of movementInputs) {
            let covered = "0"
            while (cmpQty(covered, m.qty) < 0) {
              const line = postedLines[cursor++]
              if (!line) throw new PostingAbort(Err.SALES_DELIVERY_POSTING_FAILED)
              const cost = await deps.costing.consume(
                orgId,
                { itemId: line.itemId, locationId: line.fromLocationId, batchId: line.batchId, movementLineId: line.id, qty: line.quantity },
                tx
              )
              if (!cost) throw new PostingAbort(Err.SALES_DELIVERY_COST_UNAVAILABLE)
              costByDeliveryLine.set(m.lineId, (costByDeliveryLine.get(m.lineId) ?? 0) + cost.totalValue)
              covered = addQty(covered, line.quantity)
            }
          }
          if (cursor !== postedLines.length) throw new PostingAbort(Err.SALES_DELIVERY_POSTING_FAILED)

          const totalCost = [...costByDeliveryLine.values()].reduce((s, v) => s + v, 0)
          let journalEntryId: string | null = null
          if (totalCost > 0) {
            const journal = await deps.accounting.postBusinessEvent(
              actorId,
              orgId,
              {
                event: "sale_cost",
                costMinor: String(totalCost),
                sourceId: current.row.id,
                sourceRef: current.row.number,
                date: current.row.deliveryDate,
              },
              tx
            )
            if (!journal.success) throw new PostingAbort(Err.SALES_DELIVERY_POSTING_FAILED)
            journalEntryId = journal.data.id
          }

          for (const dl of current.lines) {
            const ol = orderLines.get(dl.salesOrderLineId)!
            const reservedLeft = subQty(ol.reservedBaseQty, consumedByLine.get(dl.id) ?? "0")
            await deps.orders.setLineCounters(
              orgId,
              ol.id,
              {
                deliveredBaseQty: addQty(ol.deliveredBaseQty, dl.baseQuantity),
                reservedBaseQty: cmpQty(reservedLeft, "0") === 1 ? reservedLeft : "0",
              },
              tx
            )
            await repo.setLineCost(orgId, dl.id, costByDeliveryLine.get(dl.id) ?? 0, tx)
          }
          await repo.updateHeader(
            orgId,
            id,
            {
              status: "POSTED",
              postedAt: new Date(),
              postedBy: actorId,
              stockMovementId: moved.data.id,
              journalEntryId,
              totalCost,
            },
            tx
          )
        })
      } catch (err) {
        if (err instanceof PostingAbort) return failWith(err.code)
        return failWith(Err.SALES_DELIVERY_PROJECTION_CONFLICT)
      }
      await audit(orgId, actorId, SALES_DELIVERY_AUDIT_EVENTS.POSTED, id)
      return loadDto(orgId, id)
    },

    /**
     * POSTED -> REVERSED, atomically: the stock comes back through a reversing movement, the cost layers are
     * recreated at the original cost, the cost journal is reversed and the delivered counters go back down.
     * The reservation is not restored: the returned goods become free stock (SPEC 17.3).
     */
    async reverse(
      actorId: string,
      orgId: string,
      id: string,
      input: ReverseSalesDeliveryInput
    ): Promise<Result<SalesDeliveryDto, Code>> {
      if (!(await can(actorId, P.REVERSE, orgId))) return forbidden()

      try {
        await repo.transaction(async (tx) => {
          const current = await repo.findAggregate(orgId, id, tx)
          if (!current) throw new PostingAbort(Err.SALES_DELIVERY_NOT_FOUND)
          if (current.row.status !== "POSTED") throw new PostingAbort(Err.SALES_DELIVERY_NOT_POSTED)

          const order = await deps.orders.findAggregate(orgId, current.row.salesOrderId, tx)
          if (!order) throw new PostingAbort(Err.SALES_DELIVERY_SALES_ORDER_NOT_FOUND)
          if (!canReverseOn(order.row.status)) throw new PostingAbort(Err.SALES_DELIVERY_SALES_ORDER_NOT_OPEN)
          const orderLines = new Map((await deps.orders.lockLines(orgId, order.row.id, tx)).map((l) => [l.id, l]))

          for (const dl of current.lines) {
            const ol = orderLines.get(dl.salesOrderLineId)
            if (!ol) throw new PostingAbort(Err.SALES_DELIVERY_LINE_NOT_ON_ORDER)
            if (cmpQty(dl.baseQuantity, ol.deliveredBaseQty) > 0) throw new PostingAbort(Err.SALES_DELIVERY_EXCEEDS_OPEN)
          }

          if (current.row.stockMovementId) {
            const reversed = await deps.stockMovement.reverse(
              actorId,
              orgId,
              current.row.stockMovementId,
              { note: `Reversal of ${current.row.number}` },
              tx
            )
            if (!reversed.success) throw new PostingAbort(Err.SALES_DELIVERY_POSTING_FAILED)
            await deps.costing.restore(
              orgId,
              {
                outgoingMovementId: current.row.stockMovementId,
                reversalMovementId: reversed.data.id,
                currency: current.row.currency,
                receivedAt: new Date(),
              },
              tx
            )
          }
          if (current.row.journalEntryId) {
            const journal = await deps.accounting.reverseJournalEntry(
              actorId,
              orgId,
              current.row.journalEntryId,
              { description: `Reversal of ${current.row.number}` },
              tx
            )
            if (!journal.success) throw new PostingAbort(Err.SALES_DELIVERY_POSTING_FAILED)
          }

          for (const dl of current.lines) {
            const ol = orderLines.get(dl.salesOrderLineId)!
            await deps.orders.setLineCounters(
              orgId,
              ol.id,
              { deliveredBaseQty: subQty(ol.deliveredBaseQty, dl.baseQuantity) },
              tx
            )
          }
          await repo.updateHeader(
            orgId,
            id,
            { status: "REVERSED", reversedAt: new Date(), reversedBy: actorId, reverseReason: input.reason },
            tx
          )
        })
      } catch (err) {
        if (err instanceof PostingAbort) return failWith(err.code)
        return failWith(Err.SALES_DELIVERY_PROJECTION_CONFLICT)
      }
      await audit(orgId, actorId, SALES_DELIVERY_AUDIT_EVENTS.REVERSED, id, { reason: input.reason })
      return loadDto(orgId, id)
    },
  }
}

export type SalesDeliveryService = ReturnType<typeof createSalesDeliveryService>
