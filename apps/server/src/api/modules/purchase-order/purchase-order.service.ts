import {
  PURCHASE_ORDER_AUDIT_EVENTS,
  PURCHASE_ORDER_MAX_MINOR_AMOUNT,
  PURCHASE_ORDER_NUMBER_PAD,
  PURCHASE_ORDER_NUMBER_PREFIX,
  PurchaseOrderErrorCode as Err,
  RoleErrorCode,
  addQty,
  computeLineAmounts,
  isPositiveQty,
  mulQty,
  purchaseOrderTranslationsEn,
  subQty,
  sumLineAmounts,
  unshippedBaseQty,
  type ActivityLogAction,
  type CancelPurchaseOrderInput,
  type ClosePurchaseOrderInput,
  type CreatePurchaseOrderInput,
  type PurchaseOrderDto,
  type PurchaseOrderLineInput,
  type PurchaseOrderNumberPreviewDto,
  type PurchaseOrderOffsetListQuery,
  type PurchaseOrderOffsetListResponse,
  type UpdatePurchaseOrderInput,
} from "@avuny/contracts"
import type { Tx } from "@avuny/db"
import { fail, ok, type Result } from "@avuny/utils"
import { toListItemDto, toPurchaseOrderDto } from "./purchase-order.mapper.js"
import { PURCHASE_ORDER_PERMISSIONS as P } from "./purchase-order.permissions.js"
import type {
  Code,
  NewLine,
  PaymentTermRef,
  PurchaseOrderServiceDeps,
} from "./purchase-order.types.js"
import type { InboundDelta } from "../inventory-projection/index.js"

const message = (code: Err) => purchaseOrderTranslationsEn.errors[code]
const failWith = (code: Err) => fail({ error: code, msg: message(code) })

export const formatPurchaseOrderNumber = (seq: number) =>
  `${PURCHASE_ORDER_NUMBER_PREFIX}${String(seq).padStart(PURCHASE_ORDER_NUMBER_PAD, "0")}`

const LOCATION_ERRORS = {
  warehouse_not_found: Err.PURCHASE_ORDER_WAREHOUSE_NOT_FOUND,
  warehouse_not_physical: Err.PURCHASE_ORDER_WAREHOUSE_NOT_PHYSICAL,
  location_not_found: Err.PURCHASE_ORDER_LOCATION_NOT_FOUND,
  location_not_in_warehouse: Err.PURCHASE_ORDER_LOCATION_NOT_IN_WAREHOUSE,
  location_not_stockable: Err.PURCHASE_ORDER_LOCATION_NOT_STOCKABLE,
  location_blocked: Err.PURCHASE_ORDER_LOCATION_BLOCKED,
} as const

const ITEM_ERRORS = {
  item_not_found: Err.PURCHASE_ORDER_ITEM_NOT_FOUND,
  item_inactive: Err.PURCHASE_ORDER_ITEM_INACTIVE,
  item_not_stocked: Err.PURCHASE_ORDER_ITEM_NOT_STOCKED,
  unit_not_in_collection: Err.PURCHASE_ORDER_UNIT_NOT_IN_COLLECTION,
} as const

const SUPPLIER_ERRORS = {
  party_not_found: Err.PURCHASE_ORDER_PARTY_NOT_FOUND,
  party_not_vendor: Err.PURCHASE_ORDER_PARTY_NOT_VENDOR,
  party_inactive: Err.PURCHASE_ORDER_PARTY_INACTIVE,
} as const

const todayIn = (timezone: string) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date())

export function createPurchaseOrderService(deps: PurchaseOrderServiceDeps) {
  const repo = deps.repository

  const can = (actorId: string, action: (typeof P)[keyof typeof P], orgId: string) =>
    deps.permissions.check({ userId: actorId }, action, { resourceId: orgId, orgId })

  const forbidden = () =>
    fail({ error: RoleErrorCode.ROLE_PERMISSION_DENIED, msg: "You do not have permission to perform this action" })

  const audit = (orgId: string, actorId: string, action: string, resourceId: string, metadata?: Record<string, unknown>) =>
    deps.activityLog.record({ orgId, actorId, action: action as ActivityLogAction, resourceId, metadata })

  const loadDto = async (orgId: string, id: string, tx?: Tx): Promise<Result<PurchaseOrderDto, Code>> => {
    const detail = await repo.findDetail(orgId, id, tx)
    if (!detail) return failWith(Err.PURCHASE_ORDER_NOT_FOUND)
    return ok({ data: toPurchaseOrderDto(detail.row, detail.lines) })
  }

  const statusError = (status: string): Err =>
    status === "CANCELLED"
      ? Err.PURCHASE_ORDER_ALREADY_CANCELLED
      : status === "CLOSED"
        ? Err.PURCHASE_ORDER_ALREADY_CLOSED
        : Err.PURCHASE_ORDER_ALREADY_CONFIRMED

  /** Validates every line against the catalog and warehouse rules and computes stored amounts. */
  const buildLines = async (
    orgId: string,
    headerWarehouseId: string | null | undefined,
    inputs: readonly PurchaseOrderLineInput[],
    tx?: Tx
  ): Promise<Result<{ lines: NewLine[]; subtotal: bigint; discount: bigint; tax: bigint; total: bigint }, Code>> => {
    const lines: NewLine[] = []
    const amounts = []
    for (const [i, input] of inputs.entries()) {
      const warehouseId = input.warehouseId ?? headerWarehouseId
      if (!warehouseId) return failWith(Err.PURCHASE_ORDER_WAREHOUSE_REQUIRED)

      const loc = await deps.locations.validate(orgId, warehouseId, input.locationId, tx)
      if (!loc.ok) return failWith(LOCATION_ERRORS[loc.reason])

      const unit = await deps.items.resolve(orgId, input.itemId, input.unitId, tx)
      if (!unit.ok) return failWith(ITEM_ERRORS[unit.reason])

      const discountRateBps = input.discountRateBps ?? 0
      const taxRateBps = input.taxRateBps ?? 0
      if (discountRateBps > 0 && BigInt(input.discountAmount ?? "0") > 0n) {
        return failWith(Err.PURCHASE_ORDER_DISCOUNT_CONFLICT)
      }
      const amount = computeLineAmounts(input.orderedQty, input.unitPrice, input.discountAmount ?? "0", {
        discountRateBps,
        taxRateBps,
      })
      if (amount.discount > amount.gross) return failWith(Err.PURCHASE_ORDER_DISCOUNT_EXCEEDS_LINE)
      const max = BigInt(PURCHASE_ORDER_MAX_MINOR_AMOUNT)
      if (amount.gross > max || amount.total > max) return failWith(Err.PURCHASE_ORDER_AMOUNT_OUT_OF_RANGE)
      amounts.push(amount)

      lines.push({
        lineNo: i + 1,
        itemId: input.itemId,
        descriptionSnapshot: input.description ?? null,
        warehouseId,
        locationId: input.locationId,
        unitId: input.unitId,
        baseUnitFactorSnapshot: unit.factor,
        orderedQty: input.orderedQty,
        orderedBaseQty: mulQty(input.orderedQty, unit.factor),
        unitPrice: Number(input.unitPrice),
        discountAmount: Number(amount.discount),
        discountRateBps,
        taxRateBps,
        lineNetAmount: Number(amount.net),
        taxAmount: Number(amount.tax),
        lineTotalAmount: Number(amount.total),
        expectedDeliveryDate: input.expectedDeliveryDate ?? null,
        notes: input.notes ?? null,
      })
    }
    const sum = sumLineAmounts(amounts)
    if (sum.subtotal > BigInt(PURCHASE_ORDER_MAX_MINOR_AMOUNT) || sum.total > BigInt(PURCHASE_ORDER_MAX_MINOR_AMOUNT)) return failWith(Err.PURCHASE_ORDER_AMOUNT_OUT_OF_RANGE)
    return ok({ data: { lines, subtotal: sum.subtotal, discount: sum.discount, tax: sum.tax, total: sum.total } })
  }

  const resolvePaymentTerm = async (
    orgId: string,
    paymentTermId: string | null | undefined,
    tx?: Tx
  ): Promise<Result<PaymentTermRef | null, Code>> => {
    if (!paymentTermId) return ok({ data: await deps.paymentTerms.getDefault(orgId) })
    const term = await deps.paymentTerms.get(orgId, paymentTermId, tx)
    if (!term) return failWith(Err.PURCHASE_ORDER_PAYMENT_TERM_NOT_FOUND)
    if (!term.isActive) return failWith(Err.PURCHASE_ORDER_PAYMENT_TERM_INACTIVE)
    return ok({ data: term })
  }

  const termSnapshot = (t: PaymentTermRef | null) => ({
    paymentTermId: t?.id ?? null,
    paymentTermNameSnapshot: t?.name ?? null,
    paymentTermMethodSnapshot: t?.method ?? null,
    paymentTermDaysSnapshot: t?.days ?? null,
  })

  const assertSupplier = async (orgId: string, partyId: string, tx?: Tx) => {
    const r = await deps.suppliers.assertActiveVendor(orgId, partyId, tx)
    return r.ok ? null : failWith(SUPPLIER_ERRORS[r.reason])
  }

  return {
    async numberPreview(actorId: string, orgId: string): Promise<Result<PurchaseOrderNumberPreviewDto, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      const settings = await deps.orgSettings.get(orgId)
      const next = (await repo.maxNumberSuffix(orgId)) + 1
      return ok({
        data: {
          number: formatPurchaseOrderNumber(next),
          today: todayIn(settings?.timezone ?? "UTC"),
          currency: settings?.currency ?? "USD",
        },
      })
    },

    async list(
      actorId: string,
      orgId: string,
      query: PurchaseOrderOffsetListQuery
    ): Promise<Result<PurchaseOrderOffsetListResponse, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      const { rows, total } = await repo.list(orgId, query)
      return ok({ data: { items: rows.map(toListItemDto), page: query.page, pageSize: query.pageSize, total } })
    },

    async get(actorId: string, orgId: string, id: string): Promise<Result<PurchaseOrderDto, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      return loadDto(orgId, id)
    },

    async create(
      actorId: string,
      orgId: string,
      input: CreatePurchaseOrderInput
    ): Promise<Result<PurchaseOrderDto, Code>> {
      if (!(await can(actorId, P.CREATE, orgId))) return forbidden()
      if (input.lines.length === 0) return failWith(Err.PURCHASE_ORDER_NO_LINES)

      const supplierFailure = await assertSupplier(orgId, input.partyId)
      if (supplierFailure) return supplierFailure
      const term = await resolvePaymentTerm(orgId, input.paymentTermId)
      if (!term.success) return term
      const built = await buildLines(orgId, input.warehouseId, input.lines)
      if (!built.success) return built
      const settings = await deps.orgSettings.get(orgId)
      if (!settings) return failWith(Err.PURCHASE_ORDER_CURRENCY_MISMATCH)

      const { lines, subtotal, discount, tax, total } = built.data
      let created: string | null = null
      for (let attempt = 0; attempt < 5 && !created; attempt++) {
        const number = formatPurchaseOrderNumber((await repo.maxNumberSuffix(orgId)) + 1)
        const inserted = await repo.insertAggregate(
          orgId,
          {
            number,
            partyId: input.partyId,
            orderDate: input.orderDate,
            expectedDeliveryDate: input.expectedDeliveryDate ?? null,
            ...termSnapshot(term.data),
            currency: settings.currency,
            warehouseId: input.warehouseId ?? null,
            supplierReference: input.supplierReference ?? null,
            notes: input.notes ?? null,
            status: "DRAFT",
            subtotalAmount: Number(subtotal),
            discountAmount: Number(discount),
            taxAmount: Number(tax),
            totalAmount: Number(total),
            createdBy: actorId,
          },
          lines
        )
        if (inserted.ok) created = inserted.row.id
      }
      if (!created) return failWith(Err.PURCHASE_ORDER_NUMBER_TAKEN)

      await audit(orgId, actorId, PURCHASE_ORDER_AUDIT_EVENTS.CREATED, created)
      return loadDto(orgId, created)
    },

    async update(
      actorId: string,
      orgId: string,
      id: string,
      input: UpdatePurchaseOrderInput
    ): Promise<Result<PurchaseOrderDto, Code>> {
      if (!(await can(actorId, P.UPDATE, orgId))) return forbidden()
      const current = await repo.findAggregate(orgId, id)
      if (!current) return failWith(Err.PURCHASE_ORDER_NOT_FOUND)
      if (current.row.status !== "DRAFT") return failWith(Err.PURCHASE_ORDER_NOT_EDITABLE)

      const partyId = input.partyId ?? current.row.partyId
      if (input.partyId) {
        const f = await assertSupplier(orgId, partyId)
        if (f) return f
      }
      const header: Parameters<typeof repo.updateHeader>[2] = {}
      if (input.partyId) header.partyId = input.partyId
      if (input.orderDate) header.orderDate = input.orderDate
      if (input.expectedDeliveryDate !== undefined) header.expectedDeliveryDate = input.expectedDeliveryDate
      if (input.supplierReference !== undefined) header.supplierReference = input.supplierReference
      if (input.notes !== undefined) header.notes = input.notes
      if (input.warehouseId !== undefined) header.warehouseId = input.warehouseId
      if (input.paymentTermId !== undefined) {
        const term = await resolvePaymentTerm(orgId, input.paymentTermId)
        if (!term.success) return term
        Object.assign(header, termSnapshot(term.data))
      }

      let newLines: NewLine[] | null = null
      if (input.lines) {
        const warehouseId = input.warehouseId === undefined ? current.row.warehouseId : input.warehouseId
        const built = await buildLines(orgId, warehouseId, input.lines)
        if (!built.success) return built
        newLines = built.data.lines
        header.subtotalAmount = Number(built.data.subtotal)
        header.discountAmount = Number(built.data.discount)
        header.taxAmount = Number(built.data.tax)
        header.totalAmount = Number(built.data.total)
      }

      await repo.transaction(async (tx) => {
        if (Object.keys(header).length > 0) await repo.updateHeader(orgId, id, header, tx)
        if (newLines) await repo.replaceLines(orgId, id, newLines, tx)
      })
      await audit(orgId, actorId, PURCHASE_ORDER_AUDIT_EVENTS.UPDATED, id)
      return loadDto(orgId, id)
    },

    async delete(actorId: string, orgId: string, id: string): Promise<Result<{ id: string }, Code>> {
      if (!(await can(actorId, P.DELETE, orgId))) return forbidden()
      const current = await repo.findAggregate(orgId, id)
      if (!current) return failWith(Err.PURCHASE_ORDER_NOT_FOUND)
      if (current.row.status !== "DRAFT") return failWith(Err.PURCHASE_ORDER_NOT_DELETABLE)
      await repo.deleteById(orgId, id)
      await audit(orgId, actorId, PURCHASE_ORDER_AUDIT_EVENTS.DELETED, id)
      return ok({ data: { id } })
    },

    async confirm(actorId: string, orgId: string, id: string): Promise<Result<PurchaseOrderDto, Code>> {
      if (!(await can(actorId, P.CONFIRM, orgId))) return forbidden()
      const current = await repo.findAggregate(orgId, id)
      if (!current) return failWith(Err.PURCHASE_ORDER_NOT_FOUND)
      if (current.row.status !== "DRAFT") return failWith(statusError(current.row.status))
      if (current.lines.length === 0) return failWith(Err.PURCHASE_ORDER_NO_LINES)

      // Re-validate: the supplier, term, items and locations may have changed since the draft was saved.
      const supplierFailure = await assertSupplier(orgId, current.row.partyId)
      if (supplierFailure) return supplierFailure
      const term = await resolvePaymentTerm(orgId, current.row.paymentTermId)
      if (!term.success) return term
      for (const line of current.lines) {
        const loc = await deps.locations.validate(orgId, line.warehouseId, line.locationId)
        if (!loc.ok) return failWith(LOCATION_ERRORS[loc.reason])
        const unit = await deps.items.resolve(orgId, line.itemId, line.unitId)
        if (!unit.ok) return failWith(ITEM_ERRORS[unit.reason])
      }

      const deltas: InboundDelta[] = current.lines.map((l) => ({
        itemId: l.itemId,
        warehouseId: l.warehouseId,
        locationId: l.locationId,
        onOrderDelta: l.orderedBaseQty,
      }))
      await repo.transaction(async (tx) => {
        await repo.updateHeader(
          orgId,
          id,
          { status: "CONFIRMED", confirmedAt: new Date(), confirmedBy: actorId, ...termSnapshot(term.data) },
          tx
        )
        await deps.projection.applyInboundDeltas(orgId, deltas, tx)
      })
      await audit(orgId, actorId, PURCHASE_ORDER_AUDIT_EVENTS.CONFIRMED, id)
      return loadDto(orgId, id)
    },

    async close(
      actorId: string,
      orgId: string,
      id: string,
      input: ClosePurchaseOrderInput
    ): Promise<Result<PurchaseOrderDto, Code>> {
      if (!(await can(actorId, P.CLOSE, orgId))) return forbidden()
      const current = await repo.findAggregate(orgId, id)
      if (!current) return failWith(Err.PURCHASE_ORDER_NOT_FOUND)
      const { status } = current.row
      if (status === "CLOSED") return failWith(Err.PURCHASE_ORDER_ALREADY_CLOSED)
      if (status === "CANCELLED") return failWith(Err.PURCHASE_ORDER_ALREADY_CANCELLED)
      if (status === "DRAFT" || status === "RECEIVED") return failWith(Err.PURCHASE_ORDER_NOT_OPEN)

      // Release what was never shipped: it stops counting as on order.
      const releases = current.lines
        .map((l) => ({ line: l, qty: unshippedBaseQty(l) }))
        .filter((r) => isPositiveQty(r.qty))
      await repo.transaction(async (tx) => {
        for (const { line, qty } of releases) {
          await repo.setLineCancelled(orgId, line.id, addQty(line.cancelledBaseQty, qty), tx)
        }
        await deps.projection.applyInboundDeltas(
          orgId,
          releases.map(({ line, qty }) => ({
            itemId: line.itemId,
            warehouseId: line.warehouseId,
            locationId: line.locationId,
            onOrderDelta: subQty("0", qty),
          })),
          tx
        )
        await repo.updateHeader(
          orgId,
          id,
          { status: "CLOSED", closeReason: input.reason, closedAt: new Date(), closedBy: actorId },
          tx
        )
      })
      await audit(orgId, actorId, PURCHASE_ORDER_AUDIT_EVENTS.CLOSED, id, { reason: input.reason })
      return loadDto(orgId, id)
    },

    async cancel(
      actorId: string,
      orgId: string,
      id: string,
      input: CancelPurchaseOrderInput
    ): Promise<Result<PurchaseOrderDto, Code>> {
      if (!(await can(actorId, P.CANCEL, orgId))) return forbidden()
      const current = await repo.findAggregate(orgId, id)
      if (!current) return failWith(Err.PURCHASE_ORDER_NOT_FOUND)
      const { status } = current.row
      if (status === "CLOSED") return failWith(Err.PURCHASE_ORDER_ALREADY_CLOSED)
      if (status === "CANCELLED") return failWith(Err.PURCHASE_ORDER_ALREADY_CANCELLED)

      if (status !== "DRAFT") {
        const active = current.lines.some((l) => isPositiveQty(l.shippedBaseQty) || isPositiveQty(l.receivedBaseQty))
        if (active || (await repo.hasShipments(orgId, id))) return failWith(Err.PURCHASE_ORDER_HAS_FULFILLMENT)
      }

      // Computed before any write so the release always uses the counters this request read.
      const releases: InboundDelta[] =
        status === "DRAFT"
          ? []
          : current.lines
              .filter((l) => isPositiveQty(subQty(l.orderedBaseQty, l.cancelledBaseQty)))
              .map((l) => ({
                itemId: l.itemId,
                warehouseId: l.warehouseId,
                locationId: l.locationId,
                onOrderDelta: subQty("0", subQty(l.orderedBaseQty, l.cancelledBaseQty)),
              }))

      await repo.transaction(async (tx) => {
        if (status !== "DRAFT") {
          for (const l of current.lines) await repo.setLineCancelled(orgId, l.id, l.orderedBaseQty, tx)
          await deps.projection.applyInboundDeltas(orgId, releases, tx)
        }
        await repo.updateHeader(
          orgId,
          id,
          { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: actorId, closeReason: input.reason ?? null },
          tx
        )
      })
      await audit(orgId, actorId, PURCHASE_ORDER_AUDIT_EVENTS.CANCELLED, id, { reason: input.reason ?? null })
      return loadDto(orgId, id)
    },
  }
}

export type PurchaseOrderService = ReturnType<typeof createPurchaseOrderService>
