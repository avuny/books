import { db } from "../../db.js"
import { accountingService } from "../accounting/index.js"
import { activityLogService } from "../activity-log/index.js"
import { paymentTermAdapter, supplierAdapter } from "../purchase-order/deps.js"
import { permissionChecker } from "../role/index.js"
import { createVendorBillRepository } from "./vendor-bill.repository.js"
import { createVendorBillService, type VendorBillService } from "./vendor-bill.service.js"
import type { VendorBillRepository } from "./vendor-bill.types.js"

let _repo: VendorBillRepository | undefined
let _service: VendorBillService | undefined

export function getVendorBillRepository(): VendorBillRepository {
  return (_repo ??= createVendorBillRepository({ db }))
}

export function getVendorBillService(): VendorBillService {
  return (_service ??= createVendorBillService({
    repository: getVendorBillRepository(),
    suppliers: supplierAdapter,
    paymentTerms: paymentTermAdapter,
    accounting: accountingService as any,
    permissions: permissionChecker,
    activityLog: { record: (entry) => activityLogService.log(entry as any) },
  }))
}

export const vendorBillService = new Proxy({} as VendorBillService, {
  get(_target, prop) {
    return (getVendorBillService() as any)[prop]
  },
})
