import type { PaymentTermDto } from "@avuny/contracts"
import type { PaymentTerm } from "@avuny/db"

export const toPaymentTermDto = (row: PaymentTerm): PaymentTermDto => ({
  id: row.id,
  code: row.code,
  name: row.name,
  method: row.method,
  days: row.days,
  isSystem: row.isSystem,
  isActive: row.isActive,
  sortOrder: row.sortOrder,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})
