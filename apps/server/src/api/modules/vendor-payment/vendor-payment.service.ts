import {
  RoleErrorCode,
  VENDOR_PAYMENT_AUDIT_EVENTS,
  VENDOR_PAYMENT_NUMBER_PAD,
  VENDOR_PAYMENT_NUMBER_PREFIX,
  VendorPaymentErrorCode as Err,
  sumAllocations,
  vendorPaymentTranslationsEn,
  type ActivityLogAction,
  type CreateVendorPaymentInput,
  type ReverseVendorPaymentInput,
  type UpdateVendorPaymentInput,
  type VendorPaymentAllocationInput,
  type VendorPaymentDto,
  type VendorPaymentListResponse,
} from "@avuny/contracts"
import type { Tx } from "@avuny/db"
import { fail, ok, type Result } from "@avuny/utils"
import { toVendorPaymentDto } from "./vendor-payment.mapper.js"
import { VENDOR_PAYMENT_PERMISSIONS as P } from "./vendor-payment.permissions.js"
import type { Code, NewAllocation, VendorPaymentListFilter, VendorPaymentServiceDeps } from "./vendor-payment.types.js"

const message = (code: Err) => vendorPaymentTranslationsEn.errors[code]
const failWith = (code: Err) => fail({ error: code, msg: message(code) })

/** Thrown inside a posting transaction to roll everything back and report one code. */
class PostingAbort extends Error {
  constructor(readonly code: Err) {
    super(code)
  }
}

export const formatVendorPaymentNumber = (seq: number) =>
  `${VENDOR_PAYMENT_NUMBER_PREFIX}${String(seq).padStart(VENDOR_PAYMENT_NUMBER_PAD, "0")}`

const supplierErrors = {
  party_not_found: Err.VENDOR_PAYMENT_SUPPLIER_NOT_FOUND,
  party_not_vendor: Err.VENDOR_PAYMENT_SUPPLIER_NOT_VENDOR,
  party_inactive: Err.VENDOR_PAYMENT_SUPPLIER_INACTIVE,
} as const

export function createVendorPaymentService(deps: VendorPaymentServiceDeps) {
  const repo = deps.repository

  const can = (actorId: string, action: (typeof P)[keyof typeof P], orgId: string) =>
    deps.permissions.check({ userId: actorId }, action, { resourceId: orgId, orgId })

  const forbidden = () =>
    fail({ error: RoleErrorCode.ROLE_PERMISSION_DENIED, msg: "You do not have permission to perform this action" })

  const audit = (orgId: string, actorId: string, action: string, resourceId: string, metadata?: Record<string, unknown>) =>
    deps.activityLog.record({ orgId, actorId, action: action as ActivityLogAction, resourceId, metadata })

  const loadDto = async (orgId: string, id: string, tx?: Tx): Promise<Result<VendorPaymentDto, Code>> => {
    const detail = await repo.findDetail(orgId, id, tx)
    if (!detail) return failWith(Err.VENDOR_PAYMENT_NOT_FOUND)
    return ok({ data: toVendorPaymentDto(detail.row, detail.allocations) })
  }

  /** Checks every allocation against its bill: posted, same supplier, within the outstanding amount. */
  const buildAllocations = async (
    orgId: string,
    partyId: string,
    inputs: readonly VendorPaymentAllocationInput[],
    opts: { excludePaymentId?: string; lock?: boolean },
    tx?: Tx
  ): Promise<Result<{ allocations: NewAllocation[]; amount: number; currency: string }, Code>> => {
    if (inputs.length === 0) return failWith(Err.VENDOR_PAYMENT_NO_ALLOCATIONS)
    const ids = inputs.map((i) => i.vendorBillId)
    if (new Set(ids).size !== ids.length) return failWith(Err.VENDOR_PAYMENT_DUPLICATE_BILLS)
    const rows = await repo.loadPayableBills(orgId, ids, opts, tx)
    const byId = new Map(rows.map((r) => [r.bill.id, r]))
    const built: NewAllocation[] = []
    let currency = ""
    for (const input of inputs) {
      const r = byId.get(input.vendorBillId)
      if (!r) return failWith(Err.VENDOR_PAYMENT_BILL_NOT_FOUND)
      if (r.bill.status !== "POSTED") return failWith(Err.VENDOR_PAYMENT_BILL_NOT_POSTED)
      if (r.bill.partyId !== partyId) return failWith(Err.VENDOR_PAYMENT_BILL_SUPPLIER_MISMATCH)
      const amount = BigInt(input.amountMinor)
      if (amount <= 0n) return failWith(Err.VENDOR_PAYMENT_AMOUNT_NOT_POSITIVE)
      if (amount > BigInt(r.bill.totalAmount) - BigInt(r.paidAmount)) return failWith(Err.VENDOR_PAYMENT_EXCEEDS_OUTSTANDING)
      currency ||= r.bill.currency
      built.push({ vendorBillId: r.bill.id, allocatedAmount: Number(amount) })
    }
    return ok({ data: { allocations: built, amount: Number(sumAllocations(inputs)), currency } })
  }

  return {
    async create(actorId: string, orgId: string, input: CreateVendorPaymentInput): Promise<Result<VendorPaymentDto, Code>> {
      if (!(await can(actorId, P.CREATE, orgId))) return forbidden()
      const supplier = await deps.suppliers.assertActiveVendor(orgId, input.partyId)
      if (!supplier.ok) return failWith(supplierErrors[supplier.reason])
      const built = await buildAllocations(orgId, input.partyId, input.allocations, {})
      if (!built.success) return built

      let createdId: string | null = null
      for (let attempt = 0; attempt < 5 && !createdId; attempt++) {
        const inserted = await repo.insertAggregate(
          orgId,
          {
            number: formatVendorPaymentNumber((await repo.maxNumberSuffix(orgId)) + 1),
            partyId: input.partyId,
            paymentDate: input.paymentDate,
            method: input.method,
            referenceNumber: input.referenceNumber?.trim() || null,
            currency: built.data.currency,
            amount: built.data.amount,
            notes: input.notes ?? null,
            status: "DRAFT",
            createdBy: actorId,
          },
          built.data.allocations
        )
        if (inserted.ok) createdId = inserted.row.id
      }
      if (!createdId) return failWith(Err.VENDOR_PAYMENT_NUMBER_TAKEN)
      await audit(orgId, actorId, VENDOR_PAYMENT_AUDIT_EVENTS.CREATED, createdId)
      return loadDto(orgId, createdId)
    },

    async list(actorId: string, orgId: string, filter: VendorPaymentListFilter): Promise<Result<VendorPaymentListResponse, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      const rows = await repo.list(orgId, filter)
      return ok({ data: { items: rows.map((r) => toVendorPaymentDto(r.row, r.allocations)) } })
    },

    async get(actorId: string, orgId: string, id: string): Promise<Result<VendorPaymentDto, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      return loadDto(orgId, id)
    },

    async update(actorId: string, orgId: string, id: string, input: UpdateVendorPaymentInput): Promise<Result<VendorPaymentDto, Code>> {
      if (!(await can(actorId, P.UPDATE, orgId))) return forbidden()
      const current = await repo.findAggregate(orgId, id)
      if (!current) return failWith(Err.VENDOR_PAYMENT_NOT_FOUND)
      if (current.row.status !== "DRAFT") return failWith(Err.VENDOR_PAYMENT_NOT_EDITABLE)

      const patch: Parameters<typeof repo.updateHeader>[2] = {}
      if (input.paymentDate) patch.paymentDate = input.paymentDate
      if (input.method) patch.method = input.method
      if (input.referenceNumber !== undefined) patch.referenceNumber = input.referenceNumber?.trim() || null
      if (input.notes !== undefined) patch.notes = input.notes
      let newAllocations: NewAllocation[] | null = null
      if (input.allocations) {
        const built = await buildAllocations(orgId, current.row.partyId, input.allocations, { excludePaymentId: id })
        if (!built.success) return built
        newAllocations = built.data.allocations
        patch.amount = built.data.amount
        patch.currency = built.data.currency
      }
      await repo.transaction(async (tx) => {
        if (Object.keys(patch).length > 0) await repo.updateHeader(orgId, id, patch, tx)
        if (newAllocations) await repo.replaceAllocations(orgId, id, newAllocations, tx)
      })
      await audit(orgId, actorId, VENDOR_PAYMENT_AUDIT_EVENTS.UPDATED, id)
      return loadDto(orgId, id)
    },

    async delete(actorId: string, orgId: string, id: string): Promise<Result<{ id: string }, Code>> {
      if (!(await can(actorId, P.DELETE, orgId))) return forbidden()
      const current = await repo.findAggregate(orgId, id)
      if (!current) return failWith(Err.VENDOR_PAYMENT_NOT_FOUND)
      if (current.row.status !== "DRAFT") return failWith(Err.VENDOR_PAYMENT_NOT_DELETABLE)
      await repo.deleteById(orgId, id)
      await audit(orgId, actorId, VENDOR_PAYMENT_AUDIT_EVENTS.DELETED, id)
      return ok({ data: { id } })
    },

    /** DRAFT -> POSTED: Dr Accounts Payable, Cr Cash or Bank by method. Bills are locked and re-checked first. */
    async post(actorId: string, orgId: string, id: string): Promise<Result<VendorPaymentDto, Code>> {
      if (!(await can(actorId, P.POST, orgId))) return forbidden()
      try {
        await repo.transaction(async (tx) => {
          const current = await repo.findAggregate(orgId, id, tx)
          if (!current) throw new PostingAbort(Err.VENDOR_PAYMENT_NOT_FOUND)
          if (current.row.status === "POSTED") throw new PostingAbort(Err.VENDOR_PAYMENT_ALREADY_POSTED)
          if (current.row.status !== "DRAFT") throw new PostingAbort(Err.VENDOR_PAYMENT_NOT_EDITABLE)
          const supplier = await deps.suppliers.assertActiveVendor(orgId, current.row.partyId, tx)
          if (!supplier.ok) throw new PostingAbort(supplierErrors[supplier.reason])

          const built = await buildAllocations(
            orgId,
            current.row.partyId,
            current.allocations.map((a) => ({ vendorBillId: a.vendorBillId, amountMinor: String(a.allocatedAmount) })),
            { excludePaymentId: id, lock: true },
            tx
          )
          if (!built.success) throw new PostingAbort(built.error as Err)
          if (built.data.amount <= 0) throw new PostingAbort(Err.VENDOR_PAYMENT_AMOUNT_NOT_POSITIVE)

          const journal = await deps.accounting.postBusinessEvent(
            actorId,
            orgId,
            {
              event: "supplier_payment",
              amountMinor: String(built.data.amount),
              method: current.row.method,
              sourceId: current.row.id,
              sourceRef: current.row.number,
              date: current.row.paymentDate,
            },
            tx
          )
          if (!journal.success) throw new PostingAbort(Err.VENDOR_PAYMENT_POSTING_FAILED)
          await repo.updateHeader(
            orgId,
            id,
            { amount: built.data.amount, status: "POSTED", postedAt: new Date(), postedBy: actorId, journalEntryId: journal.data.id },
            tx
          )
        })
      } catch (err) {
        if (err instanceof PostingAbort) return failWith(err.code)
        throw err
      }
      await audit(orgId, actorId, VENDOR_PAYMENT_AUDIT_EVENTS.POSTED, id)
      return loadDto(orgId, id)
    },

    /** POSTED -> REVERSED: the journal is reversed and the bills owe the amount again. */
    async reverse(actorId: string, orgId: string, id: string, input: ReverseVendorPaymentInput): Promise<Result<VendorPaymentDto, Code>> {
      if (!(await can(actorId, P.REVERSE, orgId))) return forbidden()
      try {
        await repo.transaction(async (tx) => {
          const current = await repo.findAggregate(orgId, id, tx)
          if (!current) throw new PostingAbort(Err.VENDOR_PAYMENT_NOT_FOUND)
          if (current.row.status !== "POSTED") throw new PostingAbort(Err.VENDOR_PAYMENT_NOT_POSTED)
          if (current.row.journalEntryId) {
            const journal = await deps.accounting.reverseJournalEntry(
              actorId,
              orgId,
              current.row.journalEntryId,
              { description: `Reversal of ${current.row.number}` },
              tx
            )
            if (!journal.success) throw new PostingAbort(Err.VENDOR_PAYMENT_POSTING_FAILED)
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
        throw err
      }
      await audit(orgId, actorId, VENDOR_PAYMENT_AUDIT_EVENTS.REVERSED, id, { reason: input.reason })
      return loadDto(orgId, id)
    },
  }
}

export type VendorPaymentService = ReturnType<typeof createVendorPaymentService>
