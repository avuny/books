import { db } from "../../db.js"
import { activityLogService } from "../activity-log/index.js"
import { createAccountingRepository } from "./accounting.repository.js"
import { createAccountingService } from "./accounting.service.js"
import type { AccountingRepository, AccountingService } from "./accounting.types.js"

let _repoInstance: AccountingRepository | undefined
let _serviceInstance: AccountingService | undefined

export function getAccountingRepository(): AccountingRepository {
  if (!_repoInstance) {
    _repoInstance = createAccountingRepository({ db })
  }
  return _repoInstance
}

export function getAccountingService(): AccountingService {
  if (!_serviceInstance) {
    _serviceInstance = createAccountingService({
      repository: getAccountingRepository(),
      activityLog: activityLogService,
    })
  }
  return _serviceInstance
}

export const accountingService = new Proxy({} as AccountingService, {
  get(_target, prop) {
    return (getAccountingService() as any)[prop]
  },
})
