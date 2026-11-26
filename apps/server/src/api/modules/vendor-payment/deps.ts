import { db } from "../../db.js"
import { accountingService } from "../accounting/index.js"
import { activityLogService } from "../activity-log/index.js"
import { supplierAdapter } from "../purchase-order/deps.js"
import { permissionChecker } from "../role/index.js"
import { createVendorPaymentRepository } from "./vendor-payment.repository.js"
import { createVendorPaymentService, type VendorPaymentService } from "./vendor-payment.service.js"
import type { VendorPaymentRepository } from "./vendor-payment.types.js"

let _repo: VendorPaymentRepository | undefined
let _service: VendorPaymentService | undefined

export function getVendorPaymentRepository(): VendorPaymentRepository {
  return (_repo ??= createVendorPaymentRepository({ db }))
}

export function getVendorPaymentService(): VendorPaymentService {
  return (_service ??= createVendorPaymentService({
    repository: getVendorPaymentRepository(),
    suppliers: supplierAdapter,
    accounting: accountingService as any,
    permissions: permissionChecker,
    activityLog: { record: (entry) => activityLogService.log(entry as any) },
  }))
}

export const vendorPaymentService = new Proxy({} as VendorPaymentService, {
  get(_target, prop) {
    return (getVendorPaymentService() as any)[prop]
  },
})
