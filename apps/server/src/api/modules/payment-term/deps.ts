import { db } from "../../db.js"
import { activityLogService } from "../activity-log/index.js"
import { permissionChecker } from "../role/index.js"
import { createPaymentTermRepository } from "./payment-term.repository.js"
import { createPaymentTermService, type PaymentTermService } from "./payment-term.service.js"
import type { PaymentTermRepository } from "./payment-term.types.js"

let _repo: PaymentTermRepository | undefined
let _service: PaymentTermService | undefined

export function getPaymentTermRepository(): PaymentTermRepository {
  return (_repo ??= createPaymentTermRepository({ db }))
}

export function getPaymentTermService(): PaymentTermService {
  return (_service ??= createPaymentTermService({
    repository: getPaymentTermRepository(),
    permissions: permissionChecker,
    activityLog: { record: (entry) => activityLogService.log(entry as any) },
  }))
}

/** Lazy singleton: safe to import at module load before the db is configured. */
export const paymentTermService = new Proxy({} as PaymentTermService, {
  get(_target, prop) {
    return (getPaymentTermService() as any)[prop]
  },
})
