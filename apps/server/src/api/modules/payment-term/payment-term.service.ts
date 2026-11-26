import {
  PAYMENT_TERMS_MAX_PER_ORG,
  PAYMENT_TERM_AUDIT_EVENTS,
  PAYMENT_TERM_METHODS_WITHOUT_DAYS,
  PaymentTermErrorCode as Err,
  RoleErrorCode,
  SYSTEM_PAYMENT_TERMS,
  paymentTermTranslationsEn,
  type ActivityLogAction,
  type CreatePaymentTermInput,
  type PaymentTermDto,
  type PaymentTermListQuery,
  type PaymentTermListResponse,
  type PaymentTermMethod,
  type UpdatePaymentTermInput,
} from "@avuny/contracts"
import { fail, ok, type Result } from "@avuny/utils"
import { toPaymentTermDto } from "./payment-term.mapper.js"
import { PAYMENT_TERM_PERMISSIONS as P } from "./payment-term.permissions.js"
import type { Code, PaymentTermServiceDeps } from "./payment-term.types.js"

const message = (code: Err) => paymentTermTranslationsEn.errors[code]
const failWith = (code: Err) => fail({ error: code, msg: message(code) })

/** Days must be 0 for methods without a day count and >= 1 for the others. */
export function validateMethodDays(method: PaymentTermMethod, days: number): Err | null {
  if (PAYMENT_TERM_METHODS_WITHOUT_DAYS.includes(method)) {
    return days === 0 ? null : Err.PAYMENT_TERM_DAYS_NOT_ALLOWED
  }
  return days >= 1 ? null : Err.PAYMENT_TERM_DAYS_REQUIRED
}

const slugify = (name: string) =>
  name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24)

export function createPaymentTermService(deps: PaymentTermServiceDeps) {
  const repo = deps.repository

  const can = (actorId: string, action: (typeof P)[keyof typeof P], orgId: string) =>
    deps.permissions.check({ userId: actorId }, action, { resourceId: orgId, orgId })

  const forbidden = () =>
    fail({ error: RoleErrorCode.ROLE_PERMISSION_DENIED, msg: "You do not have permission to perform this action" })

  const audit = (orgId: string, actorId: string, action: string, resourceId: string) =>
    deps.activityLog.record({ orgId, actorId, action: action as ActivityLogAction, resourceId })

  /** Lazy, idempotent seed of the system terms for one organization. */
  const ensureSystemTerms = async (orgId: string) => {
    if ((await repo.countSystem(orgId)) >= SYSTEM_PAYMENT_TERMS.length) return
    await repo.insertSystemTerms(
      orgId,
      SYSTEM_PAYMENT_TERMS.map((t) => ({
        code: t.code,
        name: t.name,
        method: t.method,
        days: t.days,
        sortOrder: t.sortOrder,
        isSystem: true,
        isActive: true,
      }))
    )
  }

  return {
    ensureSystemTerms,

    async list(
      actorId: string,
      orgId: string,
      query: PaymentTermListQuery
    ): Promise<Result<PaymentTermListResponse, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      await ensureSystemTerms(orgId)
      const [rows, total] = await Promise.all([
        repo.list(orgId, { includeInactive: query.includeInactive ?? false }),
        repo.count(orgId),
      ])
      return ok({ data: { items: rows.map(toPaymentTermDto), max: PAYMENT_TERMS_MAX_PER_ORG, total } })
    },

    async create(
      actorId: string,
      orgId: string,
      input: CreatePaymentTermInput
    ): Promise<Result<PaymentTermDto, Code>> {
      if (!(await can(actorId, P.CREATE, orgId))) return forbidden()
      const daysError = validateMethodDays(input.method, input.days)
      if (daysError) return failWith(daysError)

      await ensureSystemTerms(orgId)
      if (await repo.findActiveByName(orgId, input.name)) return failWith(Err.PAYMENT_TERM_NAME_TAKEN)
      if ((await repo.count(orgId)) >= PAYMENT_TERMS_MAX_PER_ORG) return failWith(Err.PAYMENT_TERM_LIMIT_REACHED)

      const base = `CUSTOM_${slugify(input.name) || "TERM"}`
      let inserted: Awaited<ReturnType<typeof repo.insert>> | null = null
      for (let attempt = 0; attempt < 5 && !(inserted && inserted.ok); attempt++) {
        const code = attempt === 0 ? base : `${base}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`
        inserted = await repo.insert(orgId, {
          code,
          name: input.name,
          method: input.method,
          days: input.days,
          isSystem: false,
          isActive: true,
          sortOrder: 100,
          createdBy: actorId,
        })
      }
      if (!inserted || !inserted.ok) return failWith(Err.PAYMENT_TERM_NAME_TAKEN)

      // The cap check above is not atomic (no real transactions, see docs/proposals). Re-count and undo on overflow.
      if ((await repo.count(orgId)) > PAYMENT_TERMS_MAX_PER_ORG) {
        await repo.deleteById(orgId, inserted.row.id)
        return failWith(Err.PAYMENT_TERM_LIMIT_REACHED)
      }

      await audit(orgId, actorId, PAYMENT_TERM_AUDIT_EVENTS.CREATED, inserted.row.id)
      return ok({ data: toPaymentTermDto(inserted.row) })
    },

    async update(
      actorId: string,
      orgId: string,
      id: string,
      input: UpdatePaymentTermInput
    ): Promise<Result<PaymentTermDto, Code>> {
      if (!(await can(actorId, P.UPDATE, orgId))) return forbidden()
      const existing = await repo.findById(orgId, id)
      if (!existing) return failWith(Err.PAYMENT_TERM_NOT_FOUND)
      if (existing.isSystem) return failWith(Err.PAYMENT_TERM_SYSTEM_READONLY)

      const method = input.method ?? existing.method
      let days = input.days ?? existing.days
      // Switching to a method without days resets the stored count.
      if (input.method && PAYMENT_TERM_METHODS_WITHOUT_DAYS.includes(input.method) && input.days === undefined) days = 0
      const daysError = validateMethodDays(method, days)
      if (daysError) return failWith(daysError)

      if (input.name && (await repo.findActiveByName(orgId, input.name, id))) {
        return failWith(Err.PAYMENT_TERM_NAME_TAKEN)
      }
      if (input.isActive === true && !existing.isActive && (await repo.findActiveByName(orgId, input.name ?? existing.name, id))) {
        return failWith(Err.PAYMENT_TERM_NAME_TAKEN)
      }

      const row = await repo.update(orgId, id, {
        name: input.name,
        method,
        days,
        isActive: input.isActive,
      })
      if (!row) return failWith(Err.PAYMENT_TERM_NOT_FOUND)
      await audit(orgId, actorId, PAYMENT_TERM_AUDIT_EVENTS.UPDATED, id)
      return ok({ data: toPaymentTermDto(row) })
    },
  }
}

export type PaymentTermService = ReturnType<typeof createPaymentTermService>
