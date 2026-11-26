import {
  PURCHASE_ORDER_OPEN_STATUSES,
  PURCHASE_SHIPMENT_AUDIT_EVENTS,
  PURCHASE_SHIPMENT_NUMBER_PAD,
  PURCHASE_SHIPMENT_NUMBER_PREFIX,
  PurchaseShipmentErrorCode as Err,
  RoleErrorCode,
  addQty,
  cmpQty,
  derivePurchaseOrderStatus,
  isPositiveQty,
  mulQty,
  purchaseShipmentTranslationsEn,
  subQty,
  unshippedBaseQty,
  type ActivityLogAction,
  type CreatePurchaseShipmentInput,
  type PurchaseShipmentDto,
  type PurchaseShipmentLineInput,
  type PurchaseShipmentListResponse,
  type ReversePurchaseShipmentInput,
  type UpdatePurchaseShipmentInput,
} from "@avuny/contracts"
import type { PurchaseOrder, PurchaseOrderLine, Tx } from "@avuny/db"
import { fail, ok, type Result } from "@avuny/utils"
import type { InboundDelta } from "../inventory-projection/index.js"
import { toPurchaseShipmentDto } from "./purchase-shipment.mapper.js"
import { PURCHASE_SHIPMENT_PERMISSIONS as P } from "./purchase-shipment.permissions.js"
import type { Code, NewShipmentLine, PurchaseShipmentServiceDeps } from "./purchase-shipment.types.js"

const message = (code: Err) => purchaseShipmentTranslationsEn.errors[code]
const failWith = (code: Err) => fail({ error: code, msg: message(code) })

export const formatPurchaseShipmentNumber = (seq: number) =>
  `${PURCHASE_SHIPMENT_NUMBER_PREFIX}${String(seq).padStart(PURCHASE_SHIPMENT_NUMBER_PAD, "0")}`

const isOpen = (status: PurchaseOrder["status"]) =>
  (PURCHASE_ORDER_OPEN_STATUSES as readonly string[]).includes(status)

export function createPurchaseShipmentService(deps: PurchaseShipmentServiceDeps) {
  const repo = deps.repository

  const can = (actorId: string, action: (typeof P)[keyof typeof P], orgId: string) =>
    deps.permissions.check({ userId: actorId }, action, { resourceId: orgId, orgId })

  const forbidden = () =>
    fail({ error: RoleErrorCode.ROLE_PERMISSION_DENIED, msg: "You do not have permission to perform this action" })

  const audit = (orgId: string, actorId: string, action: string, resourceId: string, metadata?: Record<string, unknown>) =>
    deps.activityLog.record({ orgId, actorId, action: action as ActivityLogAction, resourceId, metadata })

  const loadDto = async (orgId: string, id: string, tx?: Tx): Promise<Result<PurchaseShipmentDto, Code>> => {
    const detail = await repo.findDetail(orgId, id, tx)
    if (!detail) return failWith(Err.PURCHASE_SHIPMENT_NOT_FOUND)
    return ok({ data: toPurchaseShipmentDto(detail.row, detail.lines) })
  }

  /** Validates shipment lines against the order's lines and unshipped quantities. */
  const buildLines = async (
    orgId: string,
    orderLines: readonly PurchaseOrderLine[],
    inputs: readonly PurchaseShipmentLineInput[]
  ): Promise<Result<NewShipmentLine[], Code>> => {
    const seen = new Set<string>()
    const built: NewShipmentLine[] = []
    for (const [i, input] of inputs.entries()) {
      const orderLine = orderLines.find((l) => l.id === input.purchaseOrderLineId)
      if (!orderLine) return failWith(Err.PURCHASE_SHIPMENT_LINE_NOT_ON_ORDER)
      if (seen.has(orderLine.id)) return failWith(Err.PURCHASE_SHIPMENT_DUPLICATE_LINES)
      seen.add(orderLine.id)
      if (!isPositiveQty(input.shippedQty)) return failWith(Err.PURCHASE_SHIPMENT_QUANTITY_NOT_POSITIVE)

      let factor = orderLine.baseUnitFactorSnapshot
      if (input.unitId !== orderLine.unitId) {
        const unit = await deps.items.resolve(orgId, orderLine.itemId, input.unitId)
        if (!unit.ok) return failWith(Err.PURCHASE_SHIPMENT_UNIT_NOT_IN_COLLECTION)
        factor = unit.factor
      }
      const baseQty = mulQty(input.shippedQty, factor)
      if (cmpQty(baseQty, unshippedBaseQty(orderLine)) > 0) return failWith(Err.PURCHASE_SHIPMENT_QUANTITY_EXCEEDS_UNSHIPPED)

      built.push({
        lineNo: i + 1,
        purchaseOrderLineId: orderLine.id,
        itemId: orderLine.itemId,
        unitId: input.unitId,
        baseUnitFactorSnapshot: factor,
        shippedQty: input.shippedQty,
        shippedBaseQty: baseQty,
        supplierBatchRef: input.supplierBatchRef ?? null,
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
      input: CreatePurchaseShipmentInput
    ): Promise<Result<PurchaseShipmentDto, Code>> {
      if (!(await can(actorId, P.CREATE, orgId))) return forbidden()
      const order = await deps.orders.findAggregate(orgId, purchaseOrderId)
      if (!order) return failWith(Err.PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_FOUND)
      if (!isOpen(order.row.status)) return failWith(Err.PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_OPEN)
      if (input.lines.length === 0) return failWith(Err.PURCHASE_SHIPMENT_NO_LINES)
      const built = await buildLines(orgId, order.lines, input.lines)
      if (!built.success) return built

      let createdId: string | null = null
      for (let attempt = 0; attempt < 5 && !createdId; attempt++) {
        const inserted = await repo.insertAggregate(
          orgId,
          {
            number: formatPurchaseShipmentNumber((await repo.maxNumberSuffix(orgId)) + 1),
            purchaseOrderId,
            partyId: order.row.partyId,
            shipmentDate: input.shipmentDate,
            carrier: input.carrier ?? null,
            trackingNumber: input.trackingNumber ?? null,
            supplierDeliveryReference: input.supplierDeliveryReference ?? null,
            status: "DRAFT",
            createdBy: actorId,
          },
          built.data
        )
        if (inserted.ok) createdId = inserted.row.id
      }
      if (!createdId) return failWith(Err.PURCHASE_SHIPMENT_NUMBER_TAKEN)
      await audit(orgId, actorId, PURCHASE_SHIPMENT_AUDIT_EVENTS.CREATED, createdId)
      return loadDto(orgId, createdId)
    },

    async listByOrder(
      actorId: string,
      orgId: string,
      purchaseOrderId: string
    ): Promise<Result<PurchaseShipmentListResponse, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      if (!(await deps.orders.findAggregate(orgId, purchaseOrderId))) {
        return failWith(Err.PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_FOUND)
      }
      const rows = await repo.listByOrder(orgId, purchaseOrderId)
      return ok({ data: { items: rows.map((r) => toPurchaseShipmentDto(r.row, r.lines)) } })
    },

    async get(actorId: string, orgId: string, id: string): Promise<Result<PurchaseShipmentDto, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      return loadDto(orgId, id)
    },

    async update(
      actorId: string,
      orgId: string,
      id: string,
      input: UpdatePurchaseShipmentInput
    ): Promise<Result<PurchaseShipmentDto, Code>> {
      if (!(await can(actorId, P.UPDATE, orgId))) return forbidden()
      const current = await repo.findAggregate(orgId, id)
      if (!current) return failWith(Err.PURCHASE_SHIPMENT_NOT_FOUND)
      if (current.row.status !== "DRAFT") return failWith(Err.PURCHASE_SHIPMENT_NOT_EDITABLE)

      let newLines: NewShipmentLine[] | null = null
      if (input.lines) {
        const order = await deps.orders.findAggregate(orgId, current.row.purchaseOrderId)
        if (!order) return failWith(Err.PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_FOUND)
        if (!isOpen(order.row.status)) return failWith(Err.PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_OPEN)
        const built = await buildLines(orgId, order.lines, input.lines)
        if (!built.success) return built
        newLines = built.data
      }
      const patch: Parameters<typeof repo.updateHeader>[2] = {}
      if (input.shipmentDate) patch.shipmentDate = input.shipmentDate
      if (input.carrier !== undefined) patch.carrier = input.carrier
      if (input.trackingNumber !== undefined) patch.trackingNumber = input.trackingNumber
      if (input.supplierDeliveryReference !== undefined) patch.supplierDeliveryReference = input.supplierDeliveryReference

      await repo.transaction(async (tx) => {
        if (Object.keys(patch).length > 0) await repo.updateHeader(orgId, id, patch, tx)
        if (newLines) await repo.replaceLines(orgId, id, newLines, tx)
      })
      await audit(orgId, actorId, PURCHASE_SHIPMENT_AUDIT_EVENTS.UPDATED, id)
      return loadDto(orgId, id)
    },

    async delete(actorId: string, orgId: string, id: string): Promise<Result<{ id: string }, Code>> {
      if (!(await can(actorId, P.DELETE, orgId))) return forbidden()
      const current = await repo.findAggregate(orgId, id)
      if (!current) return failWith(Err.PURCHASE_SHIPMENT_NOT_FOUND)
      if (current.row.status !== "DRAFT") return failWith(Err.PURCHASE_SHIPMENT_NOT_DELETABLE)
      await repo.deleteById(orgId, id)
      await audit(orgId, actorId, PURCHASE_SHIPMENT_AUDIT_EVENTS.DELETED, id)
      return ok({ data: { id } })
    },

    /** DRAFT -> POSTED: quantity moves from on order to in transit. */
    async post(actorId: string, orgId: string, id: string): Promise<Result<PurchaseShipmentDto, Code>> {
      if (!(await can(actorId, P.POST, orgId))) return forbidden()
      const current = await repo.findAggregate(orgId, id)
      if (!current) return failWith(Err.PURCHASE_SHIPMENT_NOT_FOUND)
      if (current.row.status === "POSTED") return failWith(Err.PURCHASE_SHIPMENT_ALREADY_POSTED)
      if (current.row.status !== "DRAFT") return failWith(Err.PURCHASE_SHIPMENT_NOT_POSTED)
      if (current.lines.length === 0) return failWith(Err.PURCHASE_SHIPMENT_NO_LINES)

      const order = await deps.orders.findAggregate(orgId, current.row.purchaseOrderId)
      if (!order) return failWith(Err.PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_FOUND)
      if (!isOpen(order.row.status)) return failWith(Err.PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_OPEN)

      // Re-check against the counters as they are now: other shipments may have posted since the draft.
      const counters = new Map(order.lines.map((l) => [l.id, { ...l }]))
      const deltas: InboundDelta[] = []
      for (const sl of current.lines) {
        const ol = counters.get(sl.purchaseOrderLineId)
        if (!ol) return failWith(Err.PURCHASE_SHIPMENT_LINE_NOT_ON_ORDER)
        if (cmpQty(sl.shippedBaseQty, unshippedBaseQty(ol)) > 0) {
          return failWith(Err.PURCHASE_SHIPMENT_QUANTITY_EXCEEDS_UNSHIPPED)
        }
        ol.shippedBaseQty = addQty(ol.shippedBaseQty, sl.shippedBaseQty)
        deltas.push({
          itemId: ol.itemId,
          warehouseId: ol.warehouseId,
          locationId: ol.locationId,
          onOrderDelta: subQty("0", sl.shippedBaseQty),
          inTransitDelta: sl.shippedBaseQty,
        })
      }
      const status = derivePurchaseOrderStatus(order.row.status, [...counters.values()])

      try {
        await repo.transaction(async (tx) => {
          for (const sl of current.lines) {
            await deps.orders.setLineShipped(orgId, sl.purchaseOrderLineId, counters.get(sl.purchaseOrderLineId)!.shippedBaseQty, tx)
          }
          await deps.projection.applyInboundDeltas(orgId, deltas, tx)
          if (status !== order.row.status) await deps.orders.updateHeader(orgId, order.row.id, { status }, tx)
          await repo.updateHeader(orgId, id, { status: "POSTED", postedAt: new Date(), postedBy: actorId }, tx)
        })
      } catch {
        return failWith(Err.PURCHASE_SHIPMENT_PROJECTION_CONFLICT)
      }
      await audit(orgId, actorId, PURCHASE_SHIPMENT_AUDIT_EVENTS.POSTED, id)
      return loadDto(orgId, id)
    },

    /**
     * POSTED -> VOIDED. Only quantity still in transit can be taken back. On an open order it
     * returns to on order. On a closed or cancelled order it is released instead, so the closed
     * order never shows stock as expected.
     */
    async reverse(
      actorId: string,
      orgId: string,
      id: string,
      input: ReversePurchaseShipmentInput
    ): Promise<Result<PurchaseShipmentDto, Code>> {
      if (!(await can(actorId, P.REVERSE, orgId))) return forbidden()
      const current = await repo.findAggregate(orgId, id)
      if (!current) return failWith(Err.PURCHASE_SHIPMENT_NOT_FOUND)
      if (current.row.status !== "POSTED") return failWith(Err.PURCHASE_SHIPMENT_NOT_POSTED)

      const order = await deps.orders.findAggregate(orgId, current.row.purchaseOrderId)
      if (!order) return failWith(Err.PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_FOUND)

      const counters = new Map(order.lines.map((l) => [l.id, { ...l }]))
      const deltas: InboundDelta[] = []
      const open = isOpen(order.row.status)
      for (const sl of current.lines) {
        const ol = counters.get(sl.purchaseOrderLineId)
        if (!ol) return failWith(Err.PURCHASE_SHIPMENT_LINE_NOT_ON_ORDER)
        const inTransit = subQty(ol.shippedBaseQty, ol.receivedBaseQty)
        if (cmpQty(sl.shippedBaseQty, inTransit) > 0) return failWith(Err.PURCHASE_SHIPMENT_ALREADY_RECEIVED)
        ol.shippedBaseQty = subQty(ol.shippedBaseQty, sl.shippedBaseQty)
        if (!open) ol.cancelledBaseQty = addQty(ol.cancelledBaseQty, sl.shippedBaseQty)
        deltas.push({
          itemId: ol.itemId,
          warehouseId: ol.warehouseId,
          locationId: ol.locationId,
          onOrderDelta: open ? sl.shippedBaseQty : "0",
          inTransitDelta: subQty("0", sl.shippedBaseQty),
        })
      }
      const status = derivePurchaseOrderStatus(order.row.status, [...counters.values()])

      try {
        await repo.transaction(async (tx) => {
          for (const sl of current.lines) {
            const ol = counters.get(sl.purchaseOrderLineId)!
            await deps.orders.setLineShipped(orgId, ol.id, ol.shippedBaseQty, tx)
            if (!open) await deps.orders.setLineCancelled(orgId, ol.id, ol.cancelledBaseQty, tx)
          }
          await deps.projection.applyInboundDeltas(orgId, deltas, tx)
          if (status !== order.row.status) await deps.orders.updateHeader(orgId, order.row.id, { status }, tx)
          await repo.updateHeader(
            orgId,
            id,
            { status: "VOIDED", voidedAt: new Date(), voidedBy: actorId, voidReason: input.reason },
            tx
          )
        })
      } catch {
        return failWith(Err.PURCHASE_SHIPMENT_PROJECTION_CONFLICT)
      }
      await audit(orgId, actorId, PURCHASE_SHIPMENT_AUDIT_EVENTS.REVERSED, id, { reason: input.reason })
      return loadDto(orgId, id)
    },
  }
}

export type PurchaseShipmentService = ReturnType<typeof createPurchaseShipmentService>
