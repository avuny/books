import { beforeEach, describe, expect, it } from "vitest"
import { PAYMENT_TERMS_MAX_PER_ORG, PaymentTermErrorCode as Err, RoleErrorCode, SYSTEM_PAYMENT_TERMS } from "@avuny/contracts"
import type { NewPaymentTerm, PaymentTerm } from "@avuny/db"
import { createPaymentTermService, validateMethodDays } from "./payment-term.service.js"
import type { PaymentTermRepository } from "./payment-term.types.js"

class InMemoryPaymentTermRepository implements PaymentTermRepository {
  rows: PaymentTerm[] = []
  private seq = 0
  async list(_o: string, { includeInactive }: { includeInactive: boolean }) {
    return this.rows.filter((r) => includeInactive || r.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
  }
  async findById(_o: string, id: string) {
    return this.rows.find((r) => r.id === id) ?? null
  }
  async findActiveByName(_o: string, name: string, exceptId?: string) {
    return this.rows.find((r) => r.isActive && r.id !== exceptId && r.name.toLowerCase() === name.toLowerCase()) ?? null
  }
  async count() {
    return this.rows.length
  }
  async countSystem() {
    return this.rows.filter((r) => r.isSystem).length
  }
  async insertSystemTerms(orgId: string, rows: readonly Omit<NewPaymentTerm, "orgId" | "id">[]) {
    for (const r of rows) if (!this.rows.some((x) => x.code === r.code)) await this.insert(orgId, r)
  }
  async insert(orgId: string, values: Omit<NewPaymentTerm, "orgId" | "id">) {
    if (this.rows.some((r) => r.code === values.code)) return { ok: false as const, reason: "code_taken" as const }
    const now = new Date()
    const row = {
      isSystem: false, isActive: true, sortOrder: 0, days: 0, createdBy: null, createdAt: now, updatedAt: now,
      ...values, id: `00000000-0000-4000-a000-${String(++this.seq).padStart(12, "0")}`, orgId,
    } as PaymentTerm
    this.rows.push(row)
    return { ok: true as const, row }
  }
  async update(_o: string, id: string, patch: Partial<PaymentTerm>) {
    const row = this.rows.find((r) => r.id === id)
    if (!row) return null
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) (row as any)[k] = v
    return row
  }
  async deleteById(_o: string, id: string) {
    this.rows = this.rows.filter((r) => r.id !== id)
  }
}

const orgId = "11111111-1111-4111-a111-111111111111"
const actorId = "22222222-2222-4222-a222-222222222222"

describe("PaymentTermService", () => {
  let repo: InMemoryPaymentTermRepository
  let allow = true
  const service = () =>
    createPaymentTermService({
      repository: repo,
      permissions: { check: async () => allow },
      activityLog: { record: async () => undefined },
    })

  beforeEach(() => {
    repo = new InMemoryPaymentTermRepository()
    allow = true
  })

  it("seeds system terms lazily and idempotently on list", async () => {
    await service().list(actorId, orgId, {})
    await service().list(actorId, orgId, {})
    const res = await service().list(actorId, orgId, {})
    expect(res.success && res.data.total).toBe(SYSTEM_PAYMENT_TERMS.length)
    expect(res.success && res.data.max).toBe(PAYMENT_TERMS_MAX_PER_ORG)
  })

  it("creates a custom term with a generated code", async () => {
    const res = await service().create(actorId, orgId, { name: "Net 90", method: "NET_DAYS", days: 90 })
    expect(res.success && res.data).toMatchObject({ name: "Net 90", isSystem: false, days: 90 })
    expect(repo.rows.find((r) => r.name === "Net 90")?.code).toBe("CUSTOM_NET_90")
  })

  it("rejects duplicate names case-insensitively", async () => {
    await service().create(actorId, orgId, { name: "Net 90", method: "NET_DAYS", days: 90 })
    expect(await service().create(actorId, orgId, { name: "net 90", method: "NET_DAYS", days: 91 })).toMatchObject({
      error: Err.PAYMENT_TERM_NAME_TAKEN,
    })
  })

  it("enforces the per-organization cap, system terms included", async () => {
    await service().list(actorId, orgId, {})
    for (let i = repo.rows.length; i < PAYMENT_TERMS_MAX_PER_ORG; i++) {
      expect((await service().create(actorId, orgId, { name: `Custom ${i}`, method: "NET_DAYS", days: i + 1 })).success).toBe(true)
    }
    expect(await service().create(actorId, orgId, { name: "One too many", method: "NET_DAYS", days: 5 })).toMatchObject({
      error: Err.PAYMENT_TERM_LIMIT_REACHED,
    })
    expect(repo.rows).toHaveLength(PAYMENT_TERMS_MAX_PER_ORG)
  })

  it("validates days against the method", () => {
    expect(validateMethodDays("DUE_ON_RECEIPT", 5)).toBe(Err.PAYMENT_TERM_DAYS_NOT_ALLOWED)
    expect(validateMethodDays("NET_DAYS", 0)).toBe(Err.PAYMENT_TERM_DAYS_REQUIRED)
    expect(validateMethodDays("END_OF_MONTH", 0)).toBeNull()
    expect(validateMethodDays("DAYS_AFTER_END_OF_MONTH", 10)).toBeNull()
  })

  it("keeps system terms read-only", async () => {
    await service().list(actorId, orgId, {})
    const system = repo.rows.find((r) => r.isSystem)!
    expect(await service().update(actorId, orgId, system.id, { name: "Renamed" })).toMatchObject({
      error: Err.PAYMENT_TERM_SYSTEM_READONLY,
    })
  })

  it("updates, resets days when switching to a method without days, and deactivates", async () => {
    const created = await service().create(actorId, orgId, { name: "Net 90", method: "NET_DAYS", days: 90 })
    const id = created.success ? created.data.id : ""
    const switched = await service().update(actorId, orgId, id, { method: "END_OF_MONTH" })
    expect(switched.success && switched.data).toMatchObject({ method: "END_OF_MONTH", days: 0 })
    const off = await service().update(actorId, orgId, id, { isActive: false })
    expect(off.success && off.data.isActive).toBe(false)
  })

  it("denies callers without permission", async () => {
    allow = false
    expect(await service().list(actorId, orgId, {})).toMatchObject({ error: RoleErrorCode.ROLE_PERMISSION_DENIED })
  })
})
