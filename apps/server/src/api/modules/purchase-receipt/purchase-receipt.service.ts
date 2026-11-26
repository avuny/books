import {
  PURCHASE_ORDER_OPEN_STATUSES,
  PURCHASE_RECEIPT_AUDIT_EVENTS,
  PURCHASE_RECEIPT_NUMBER_PAD,
  PURCHASE_RECEIPT_NUMBER_PREFIX,
  PURCHASE_RECEIPT_SOURCE_TYPE,
  PurchaseReceiptErrorCode as Err,
  RoleErrorCode,
  addQty,
  cmpQty,
  computeReceiptValue,
  computeUnitCostSnapshot,
  derivePurchaseOrderStatus,
  inTransitBaseQty,
  isPositiveQty,
  mulQty,
  purchaseReceiptTranslationsEn,
  subQty,
  unshippedBaseQty,
  type ActivityLogAction,
  type CreatePurchaseReceiptInput,
  type PurchaseReceiptDto,
  type PurchaseReceiptLineInput,
  type PurchaseReceiptListResponse,
  type ReversePurchaseReceiptInput,
  type UpdatePurchaseReceiptInput,
} from "@avuny/contracts"
import type { PurchaseOrder, PurchaseOrderLine, PurchaseReceiptLine, Tx } from "@avuny/db"
import { fail, ok, type Result } from "@avuny/utils"
import type { InboundDelta } from "../inventory-projection/index.js"
import { toPurchaseReceiptDto } from "./purchase-receipt.mapper.js"
import { PURCHASE_RECEIPT_PERMISSIONS as P } from "./purchase-receipt.permissions.js"
import type { Code, NewReceiptLine, PurchaseReceiptServiceDeps } from "./purchase-receipt.types.js"

const message = (code: Err) => purchaseReceiptTranslationsEn.errors[code]
const failWith = (code: Err) => fail({ error: code, msg: message(code) })

/** Thrown inside a posting transaction to roll everything back and report one code. */
class PostingAbort extends Error {
  constructor(readonly code: Err) {
    super(code)
  }
}

export const formatPurchaseReceiptNumber = (seq: number) =>
  `${PURCHASE_RECEIPT_NUMBER_PREFIX}${String(seq).padStart(PURCHASE_RECEIPT_NUMBER_PAD, "0")}`

const isOpen = (status: PurchaseOrder["status"]) =>
  (PURCHASE_ORDER_OPEN_STATUSES as readonly string[]).includes(status)

/** Reversing a receipt on a fully received order is fine; it reopens the order. */
const canReverseOn = (status: PurchaseOrder["status"]) => isOpen(status) || status === "RECEIVED"

type Counters = PurchaseOrderLine

/**
 * Counter and projection effect of one receipt line (PO SPEC 3.3): received counts everything that
 * physically arrived (accepted + rejected), accepted and rejected are tracked separately.
 * Direct: goods that were never shipped. They are shipped and received together, so on order drops.
 * Shipped: goods that were in transit. Everything received leaves transit.
 */
function applyLine(ol: Counters, l: PurchaseReceiptLine, direction: 1 | -1): InboundDelta {
  const neg = (q: string) => subQty("0", q)
  const signed = (q: string) => (direction === 1 ? q : neg(q))
  const move = (cur: string, q: string) => addQty(cur, signed(q))
  const received = l.receivedBaseQty
  ol.receivedBaseQty = move(ol.receivedBaseQty, received)
  ol.acceptedBaseQty = move(ol.acceptedBaseQty, l.acceptedBaseQty)
  ol.rejectedBaseQty = move(ol.rejectedBaseQty, l.rejectedBaseQty)
  const base = { itemId: ol.itemId, warehouseId: ol.warehouseId, locationId: ol.locationId }
  if (l.isDirect) {
    ol.shippedBaseQty = move(ol.shippedBaseQty, received)
    return { ...base, onOrderDelta: signed(neg(received)) }
  }
  return { ...base, inTransitDelta: signed(neg(received)) }
}

export function createPurchaseReceiptService(deps: PurchaseReceiptServiceDeps) {
  const repo = deps.repository

  const can = (actorId: string, action: (typeof P)[keyof typeof P], orgId: string) =>
    deps.permissions.check({ userId: actorId }, action, { resourceId: orgId, orgId })

  const forbidden = () =>
    fail({ error: RoleErrorCode.ROLE_PERMISSION_DENIED, msg: "You do not have permission to perform this action" })

  const audit = (orgId: string, actorId: string, action: string, resourceId: string, metadata?: Record<string, unknown>) =>
    deps.activityLog.record({ orgId, actorId, action: action as ActivityLogAction, resourceId, metadata })

  const loadDto = async (orgId: string, id: string, tx?: Tx): Promise<Result<PurchaseReceiptDto, Code>> => {
    const detail = await repo.findDetail(orgId, id, tx)
    if (!detail) return failWith(Err.PURCHASE_RECEIPT_NOT_FOUND)
    return ok({ data: toPurchaseReceiptDto(detail.row, detail.lines) })
  }

  /** Checks one line against the order line's current counters. Shared by create, update and post. */
  const checkQuantities = (ol: PurchaseOrderLine, isDirect: boolean, receivedBase: string): Err | null =>
    isDirect
      ? cmpQty(receivedBase, unshippedBaseQty(ol)) > 0
        ? Err.PURCHASE_RECEIPT_EXCEEDS_UNSHIPPED
        : null
      : cmpQty(receivedBase, inTransitBaseQty(ol)) > 0
        ? Err.PURCHASE_RECEIPT_EXCEEDS_IN_TRANSIT
        : null

  const buildLines = async (
    orgId: string,
    orderLines: readonly PurchaseOrderLine[],
    inputs: readonly PurchaseReceiptLineInput[]
  ): Promise<Result<NewReceiptLine[], Code>> => {
    const seen = new Set<string>()
    const built: NewReceiptLine[] = []
    for (const [i, input] of inputs.entries()) {
      const ol = orderLines.find((l) => l.id === input.purchaseOrderLineId)
      if (!ol) return failWith(Err.PURCHASE_RECEIPT_LINE_NOT_ON_ORDER)
      if (seen.has(ol.id)) return failWith(Err.PURCHASE_RECEIPT_DUPLICATE_LINES)
      seen.add(ol.id)
      if (!isPositiveQty(input.receivedQty)) return failWith(Err.PURCHASE_RECEIPT_QUANTITY_NOT_POSITIVE)
      const rejectedQty = input.rejectedQty ?? "0"
      if (cmpQty(addQty(input.acceptedQty, rejectedQty), input.receivedQty) !== 0) {
        return failWith(Err.PURCHASE_RECEIPT_QUANTITY_MISMATCH)
      }
      if (cmpQty(rejectedQty, "0") > 0 && !input.rejectionReason?.trim()) {
        return failWith(Err.PURCHASE_RECEIPT_REJECTION_REASON_REQUIRED)
      }

      let factor = ol.baseUnitFactorSnapshot
      if (input.unitId !== ol.unitId) {
        const unit = await deps.items.resolve(orgId, ol.itemId, input.unitId)
        if (!unit.ok) return failWith(Err.PURCHASE_RECEIPT_UNIT_NOT_IN_COLLECTION)
        factor = unit.factor
      }
      const receivedBase = mulQty(input.receivedQty, factor)
      const acceptedBase = mulQty(input.acceptedQty, factor)
      const rejectedBase = mulQty(rejectedQty, factor)
      const isDirect = input.isDirect ?? false
      const over = checkQuantities(ol, isDirect, receivedBase)
      if (over) return failWith(over)

      const location = await deps.locations.validate(orgId, ol.warehouseId, input.locationId)
      if (!location.ok) return failWith(Err.PURCHASE_RECEIPT_LOCATION_REQUIRED)

      const net = String(ol.lineNetAmount ?? 0)
      built.push({
        lineNo: i + 1,
        purchaseOrderLineId: ol.id,
        itemId: ol.itemId,
        warehouseId: ol.warehouseId,
        locationId: input.locationId,
        unitId: input.unitId,
        baseUnitFactorSnapshot: factor,
        receivedQty: input.receivedQty,
        acceptedQty: input.acceptedQty,
        rejectedQty,
        receivedBaseQty: receivedBase,
        acceptedBaseQty: acceptedBase,
        rejectedBaseQty: rejectedBase,
        isDirect,
        batchId: input.batchId ?? null,
        expiresOn: input.expiresOn ?? null,
        unitCostSnapshot: Number(computeUnitCostSnapshot(ol.orderedBaseQty, net)),
        receiptValue: Number(computeReceiptValue(acceptedBase, ol.orderedBaseQty, net)),
        rejectionReason: cmpQty(rejectedQty, "0") > 0 ? (input.rejectionReason?.trim() ?? null) : null,
        notes: input.notes ?? null,
      })
    }
    return ok({ data: built })
  }

  return {
    async createForOrder(
      actorId: string,
      orgId: string,
      purchaseOrderId: string,
      input: CreatePurchaseReceiptInput
    ): Promise<Result<PurchaseReceiptDto, Code>> {
      if (!(await can(actorId, P.CREATE, orgId))) return forbidden()
      const order = await deps.orders.findAggregate(orgId, purchaseOrderId)
      if (!order) return failWith(Err.PURCHASE_RECEIPT_PURCHASE_ORDER_NOT_FOUND)
      if (!isOpen(order.row.status)) return failWith(Err.PURCHASE_RECEIPT_PURCHASE_ORDER_NOT_OPEN)
      if (input.lines.length === 0) return failWith(Err.PURCHASE_RECEIPT_NO_LINES)
      const built = await buildLines(orgId, order.lines, input.lines)
      if (!built.success) return built
      const totalValue = built.data.reduce((sum, l) => sum + Number(l.receiptValue ?? 0), 0)

      let createdId: string | null = null
      for (let attempt = 0; attempt < 5 && !createdId; attempt++) {
        const inserted = await repo.insertAggregate(
          orgId,
          {
            number: formatPurchaseReceiptNumber((await repo.maxNumberSuffix(orgId)) + 1),
            purchaseOrderId,
            partyId: order.row.partyId,
            receiptDate: input.receiptDate,
            supplierDeliveryReference: input.supplierDeliveryReference ?? null,
            notes: input.notes ?? null,
            status: "DRAFT",
            currency: order.row.currency,
            totalValue,
            createdBy: actorId,
          },
          built.data
        )
        if (inserted.ok) createdId = inserted.row.id
      }
      if (!createdId) return failWith(Err.PURCHASE_RECEIPT_NUMBER_TAKEN)
      await audit(orgId, actorId, PURCHASE_RECEIPT_AUDIT_EVENTS.CREATED, createdId)
      return loadDto(orgId, createdId)
    },

    async listByOrder(
      actorId: string,
      orgId: string,
      purchaseOrderId: string
    ): Promise<Result<PurchaseReceiptListResponse, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      if (!(await deps.orders.findAggregate(orgId, purchaseOrderId))) {
        return failWith(Err.PURCHASE_RECEIPT_PURCHASE_ORDER_NOT_FOUND)
      }
      const rows = await repo.listByOrder(orgId, purchaseOrderId)
      return ok({ data: { items: rows.map((r) => toPurchaseReceiptDto(r.row, r.lines)) } })
    },

    async get(actorId: string, orgId: string, id: string): Promise<Result<PurchaseReceiptDto, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      return loadDto(orgId, id)
    },

    async update(
      actorId: string,
      orgId: string,
      id: string,
      input: UpdatePurchaseReceiptInput
    ): Promise<Result<PurchaseReceiptDto, Code>> {
      if (!(await can(actorId, P.UPDATE, orgId))) return forbidden()
      const current = await repo.findAggregate(orgId, id)
      if (!current) return failWith(Err.PURCHASE_RECEIPT_NOT_FOUND)
      if (current.row.status !== "DRAFT") return failWith(Err.PURCHASE_RECEIPT_NOT_EDITABLE)

      let newLines: NewReceiptLine[] | null = null
      if (input.lines) {
        const order = await deps.orders.findAggregate(orgId, current.row.purchaseOrderId)
        if (!order) return failWith(Err.PURCHASE_RECEIPT_PURCHASE_ORDER_NOT_FOUND)
        if (!isOpen(order.row.status)) return failWith(Err.PURCHASE_RECEIPT_PURCHASE_ORDER_NOT_OPEN)
        const built = await buildLines(orgId, order.lines, input.lines)
        if (!built.success) return built
        newLines = built.data
      }
      const patch: Parameters<typeof repo.updateHeader>[2] = {}
      if (input.receiptDate) patch.receiptDate = input.receiptDate
      if (input.supplierDeliveryReference !== undefined) patch.supplierDeliveryReference = input.supplierDeliveryReference
      if (input.notes !== undefined) patch.notes = input.notes
      if (newLines) patch.totalValue = newLines.reduce((sum, l) => sum + Number(l.receiptValue ?? 0), 0)

      await repo.transaction(async (tx) => {
        if (Object.keys(patch).length > 0) await repo.updateHeader(orgId, id, patch, tx)
        if (newLines) await repo.replaceLines(orgId, id, newLines, tx)
      })
      await audit(orgId, actorId, PURCHASE_RECEIPT_AUDIT_EVENTS.UPDATED, id)
      return loadDto(orgId, id)
    },

    async delete(actorId: string, orgId: string, id: string): Promise<Result<{ id: string }, Code>> {
      if (!(await can(actorId, P.DELETE, orgId))) return forbidden()
      const current = await repo.findAggregate(orgId, id)
      if (!current) return failWith(Err.PURCHASE_RECEIPT_NOT_FOUND)
      if (current.row.status !== "DRAFT") return failWith(Err.PURCHASE_RECEIPT_NOT_DELETABLE)
      await repo.deleteById(orgId, id)
      await audit(orgId, actorId, PURCHASE_RECEIPT_AUDIT_EVENTS.DELETED, id)
      return ok({ data: { id } })
    },

    /**
     * DRAFT -> POSTED, atomically: accepted goods go on hand (purchase movement), cost layers are created,
     * the goods receipt journal is posted (Dr inventory, Cr GRNI) and the order counters and projection move.
     */
    async post(actorId: string, orgId: string, id: string): Promise<Result<PurchaseReceiptDto, Code>> {
      if (!(await can(actorId, P.POST, orgId))) return forbidden()

      try {
        await repo.transaction(async (tx) => {
          const current = await repo.findAggregate(orgId, id, tx)
          if (!current) throw new PostingAbort(Err.PURCHASE_RECEIPT_NOT_FOUND)
          if (current.row.status === "POSTED") throw new PostingAbort(Err.PURCHASE_RECEIPT_ALREADY_POSTED)
          if (current.row.status !== "DRAFT") throw new PostingAbort(Err.PURCHASE_RECEIPT_NOT_POSTED)
          if (current.lines.length === 0) throw new PostingAbort(Err.PURCHASE_RECEIPT_NO_LINES)

          const order = await deps.orders.findAggregate(orgId, current.row.purchaseOrderId, tx)
          if (!order) throw new PostingAbort(Err.PURCHASE_RECEIPT_PURCHASE_ORDER_NOT_FOUND)
          if (!isOpen(order.row.status)) throw new PostingAbort(Err.PURCHASE_RECEIPT_PURCHASE_ORDER_NOT_OPEN)

          // Re-check against the counters as they are now: other receipts or shipments may have posted since the draft.
          const counters = new Map(order.lines.map((l) => [l.id, { ...l }]))
          const deltas: InboundDelta[] = []
          for (const rl of current.lines) {
            const ol = counters.get(rl.purchaseOrderLineId)
            if (!ol) throw new PostingAbort(Err.PURCHASE_RECEIPT_LINE_NOT_ON_ORDER)
            const over = checkQuantities(ol, rl.isDirect, rl.receivedBaseQty)
            if (over) throw new PostingAbort(over)
            deltas.push(applyLine(ol, rl, 1))
          }
          const status = derivePurchaseOrderStatus(order.row.status, [...counters.values()])

          // Stock, cost layers and journal for the accepted goods.
          const accepted = current.lines.filter((l) => isPositiveQty(l.acceptedBaseQty))
          let stockMovementId: string | null = null
          let journalEntryId: string | null = null
          let totalValue = 0
          // Batches under the hood: a batch-tracked item without a chosen batch gets a new batch for this receipt line.
          const batchByLine = new Map<string, string>()
          if (deps.batches) {
            for (const l of accepted) {
              if (l.batchId) continue
              const batchId = await deps.batches.resolve(
                orgId,
                {
                  itemId: l.itemId,
                  number: `${current.row.number}-${l.lineNo}`,
                  manufacturedOn: current.row.receiptDate,
                  expiresOn: l.expiresOn ?? null,
                },
                tx
              )
              if (batchId) {
                batchByLine.set(l.id, batchId)
                await deps.repository.setLineBatch(orgId, l.id, batchId, tx)
              }
            }
          }
          if (accepted.length > 0) {
            const moved = await deps.stockMovement.post(
              actorId,
              orgId,
              {
                type: "purchase",
                sourceType: PURCHASE_RECEIPT_SOURCE_TYPE,
                sourceId: current.row.id,
                sourceRef: current.row.number,
                lines: accepted.map((l) => ({
                  itemId: l.itemId,
                  batchId: l.batchId ?? batchByLine.get(l.id) ?? undefined,
                  toLocationId: l.locationId,
                  quantity: l.acceptedBaseQty,
                })),
              },
              tx
            )
            if (!moved.success) throw new PostingAbort(Err.PURCHASE_RECEIPT_POSTING_FAILED)
            stockMovementId = moved.data.id
            const postedLines = [...moved.data.lines].sort((a, b) => a.lineNo - b.lineNo)
            for (const [i, l] of accepted.entries()) {
              const posted = postedLines[i]
              if (!posted) throw new PostingAbort(Err.PURCHASE_RECEIPT_POSTING_FAILED)
              totalValue += Number(l.receiptValue)
              await deps.costing.createLayer(
                orgId,
                {
                  itemId: l.itemId,
                  locationId: l.locationId,
                  batchId: l.batchId ?? batchByLine.get(l.id) ?? null,
                  movementLineId: posted.id,
                  qty: l.acceptedBaseQty,
                  valueMinor: String(l.receiptValue),
                  currency: current.row.currency,
                  receivedAt: new Date(`${current.row.receiptDate}T00:00:00.000Z`),
                },
                tx
              )
            }
            if (totalValue > 0) {
              const journal = await deps.accounting.postBusinessEvent(
                actorId,
                orgId,
                {
                  event: "goods_receipt",
                  goodsMinor: String(totalValue),
                  sourceId: current.row.id,
                  sourceRef: current.row.number,
                  date: current.row.receiptDate,
                },
                tx
              )
              if (!journal.success) throw new PostingAbort(Err.PURCHASE_RECEIPT_POSTING_FAILED)
              journalEntryId = journal.data.id
            }
          }

          for (const rl of current.lines) {
            const ol = counters.get(rl.purchaseOrderLineId)!
            await deps.orders.setLineShippedReceived(
              orgId,
              ol.id,
              {
                shippedBaseQty: ol.shippedBaseQty,
                receivedBaseQty: ol.receivedBaseQty,
                acceptedBaseQty: ol.acceptedBaseQty,
                rejectedBaseQty: ol.rejectedBaseQty,
              },
              tx
            )
          }
          await deps.projection.applyInboundDeltas(orgId, deltas, tx)
          if (status !== order.row.status) await deps.orders.updateHeader(orgId, order.row.id, { status }, tx)
          await repo.updateHeader(
            orgId,
            id,
            { status: "POSTED", postedAt: new Date(), postedBy: actorId, stockMovementId, journalEntryId, totalValue },
            tx
          )
        })
      } catch (err) {
        if (err instanceof PostingAbort) return failWith(err.code)
        return failWith(Err.PURCHASE_RECEIPT_PROJECTION_CONFLICT)
      }
      await audit(orgId, actorId, PURCHASE_RECEIPT_AUDIT_EVENTS.POSTED, id)
      return loadDto(orgId, id)
    },

    /**
     * POSTED -> REVERSED, atomically: the movement, the cost layers, the journal and the order counters
     * all go back. Refused when the received stock was already used (layers consumed or stock below zero).
     */
    async reverse(
      actorId: string,
      orgId: string,
      id: string,
      input: ReversePurchaseReceiptInput
    ): Promise<Result<PurchaseReceiptDto, Code>> {
      if (!(await can(actorId, P.REVERSE, orgId))) return forbidden()

      try {
        await repo.transaction(async (tx) => {
          const current = await repo.findAggregate(orgId, id, tx)
          if (!current) throw new PostingAbort(Err.PURCHASE_RECEIPT_NOT_FOUND)
          if (current.row.status !== "POSTED") throw new PostingAbort(Err.PURCHASE_RECEIPT_NOT_POSTED)
          if (await repo.hasPostedBills(orgId, id, tx)) throw new PostingAbort(Err.PURCHASE_RECEIPT_ALREADY_BILLED)

          const order = await deps.orders.findAggregate(orgId, current.row.purchaseOrderId, tx)
          if (!order) throw new PostingAbort(Err.PURCHASE_RECEIPT_PURCHASE_ORDER_NOT_FOUND)
          if (!canReverseOn(order.row.status)) throw new PostingAbort(Err.PURCHASE_RECEIPT_PURCHASE_ORDER_NOT_OPEN)

          const counters = new Map(order.lines.map((l) => [l.id, { ...l }]))
          const deltas: InboundDelta[] = []
          for (const rl of current.lines) {
            const ol = counters.get(rl.purchaseOrderLineId)
            if (!ol) throw new PostingAbort(Err.PURCHASE_RECEIPT_LINE_NOT_ON_ORDER)
            if (cmpQty(rl.receivedBaseQty, ol.receivedBaseQty) > 0) throw new PostingAbort(Err.PURCHASE_RECEIPT_EXCEEDS_IN_TRANSIT)
            deltas.push(applyLine(ol, rl, -1))
          }
          const status = derivePurchaseOrderStatus(order.row.status, [...counters.values()])

          if (current.row.stockMovementId) {
            const layers = await deps.costing.findLayers(orgId, current.row.stockMovementId, tx)
            if (layers.some(({ layer }) => cmpQty(layer.remainingQty, layer.receivedQty) !== 0)) {
              throw new PostingAbort(Err.PURCHASE_RECEIPT_STOCK_ALREADY_USED)
            }
            const reversed = await deps.stockMovement.reverse(
              actorId,
              orgId,
              current.row.stockMovementId,
              { note: `Reversal of ${current.row.number}` },
              tx
            )
            if (!reversed.success) throw new PostingAbort(Err.PURCHASE_RECEIPT_STOCK_ALREADY_USED)
            for (const { lineNo, layer } of layers) {
              const line = reversed.data.lines.find((l) => l.lineNo === lineNo)
              if (!line) throw new PostingAbort(Err.PURCHASE_RECEIPT_POSTING_FAILED)
              await deps.costing.consumeLayer(orgId, layer, line.id, tx)
            }
          }
          if (current.row.journalEntryId) {
            const journal = await deps.accounting.reverseJournalEntry(
              actorId,
              orgId,
              current.row.journalEntryId,
              { description: `Reversal of ${current.row.number}` },
              tx
            )
            if (!journal.success) throw new PostingAbort(Err.PURCHASE_RECEIPT_POSTING_FAILED)
          }

          for (const rl of current.lines) {
            const ol = counters.get(rl.purchaseOrderLineId)!
            await deps.orders.setLineShippedReceived(
              orgId,
              ol.id,
              {
                shippedBaseQty: ol.shippedBaseQty,
                receivedBaseQty: ol.receivedBaseQty,
                acceptedBaseQty: ol.acceptedBaseQty,
                rejectedBaseQty: ol.rejectedBaseQty,
              },
              tx
            )
          }
          await deps.projection.applyInboundDeltas(orgId, deltas, tx)
          if (status !== order.row.status) await deps.orders.updateHeader(orgId, order.row.id, { status }, tx)
          await repo.updateHeader(
            orgId,
            id,
            { status: "REVERSED", reversedAt: new Date(), reversedBy: actorId, reverseReason: input.reason },
            tx
          )
        })
      } catch (err) {
        if (err instanceof PostingAbort) return failWith(err.code)
        return failWith(Err.PURCHASE_RECEIPT_PROJECTION_CONFLICT)
      }
      await audit(orgId, actorId, PURCHASE_RECEIPT_AUDIT_EVENTS.REVERSED, id, { reason: input.reason })
      return loadDto(orgId, id)
    },
  }
}

export type PurchaseReceiptService = ReturnType<typeof createPurchaseReceiptService>
