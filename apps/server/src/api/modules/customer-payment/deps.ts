import { db } from "../../db.js"
import { accountingService } from "../accounting/index.js"
import { activityLogService } from "../activity-log/index.js"
import { customerAdapter } from "../sales-order/deps.js"
import { permissionChecker } from "../role/index.js"
import { createCustomerPaymentRepository } from "./customer-payment.repository.js"
import { createCustomerPaymentService, type CustomerPaymentService } from "./customer-payment.service.js"
import type { CustomerPaymentRepository } from "./customer-payment.types.js"

let _repo: CustomerPaymentRepository | undefined
let _service: CustomerPaymentService | undefined

export function getCustomerPaymentRepository(): CustomerPaymentRepository {
  return (_repo ??= createCustomerPaymentRepository({ db }))
}

export function getCustomerPaymentService(): CustomerPaymentService {
  return (_service ??= createCustomerPaymentService({
    repository: getCustomerPaymentRepository(),
    customers: customerAdapter,
    accounting: accountingService as any,
    permissions: permissionChecker,
    activityLog: { record: (entry) => activityLogService.log(entry as any) },
  }))
}

export const customerPaymentService = new Proxy({} as CustomerPaymentService, {
  get(_target, prop) {
    return (getCustomerPaymentService() as any)[prop]
  },
})
