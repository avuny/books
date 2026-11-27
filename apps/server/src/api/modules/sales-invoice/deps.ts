import { db } from "../../db.js"
import { accountingService } from "../accounting/index.js"
import { activityLogService } from "../activity-log/index.js"
import { customerAdapter, getSalesOrderRepository, paymentTermAdapter } from "../sales-order/deps.js"
import { permissionChecker } from "../role/index.js"
import { customerPaymentService } from "../customer-payment/index.js"
import { createSalesInvoiceRepository } from "./sales-invoice.repository.js"
import { createSalesInvoiceService, type SalesInvoiceService } from "./sales-invoice.service.js"
import type { SalesInvoiceRepository } from "./sales-invoice.types.js"

let _repo: SalesInvoiceRepository | undefined
let _service: SalesInvoiceService | undefined

export function getSalesInvoiceRepository(): SalesInvoiceRepository {
  return (_repo ??= createSalesInvoiceRepository({ db }))
}

export function getSalesInvoiceService(): SalesInvoiceService {
  return (_service ??= createSalesInvoiceService({
    repository: getSalesInvoiceRepository(),
    orders: getSalesOrderRepository(),
    customers: customerAdapter,
    paymentTerms: paymentTermAdapter,
    accounting: accountingService as any,
    payments: customerPaymentService as any,
    permissions: permissionChecker,
    activityLog: { record: (entry) => activityLogService.log(entry as any) },
  }))
}

export const salesInvoiceService = new Proxy({} as SalesInvoiceService, {
  get(_target, prop) {
    return (getSalesInvoiceService() as any)[prop]
  },
})
