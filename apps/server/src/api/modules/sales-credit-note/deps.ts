import { db } from "../../db.js"
import { accountingService } from "../accounting/index.js"
import { activityLogService } from "../activity-log/index.js"
import { permissionChecker } from "../role/index.js"
import { createSalesCreditNoteRepository } from "./sales-credit-note.repository.js"
import { createSalesCreditNoteService, type SalesCreditNoteService } from "./sales-credit-note.service.js"
import type { SalesCreditNoteRepository } from "./sales-credit-note.types.js"

let _repo: SalesCreditNoteRepository | undefined
let _service: SalesCreditNoteService | undefined

export function getSalesCreditNoteRepository(): SalesCreditNoteRepository {
  return (_repo ??= createSalesCreditNoteRepository({ db }))
}

export function getSalesCreditNoteService(): SalesCreditNoteService {
  return (_service ??= createSalesCreditNoteService({
    repository: getSalesCreditNoteRepository(),
    accounting: accountingService as any,
    permissions: permissionChecker,
    activityLog: { record: (entry) => activityLogService.log(entry as any) },
  }))
}

export const salesCreditNoteService = new Proxy({} as SalesCreditNoteService, {
  get(_target, prop) {
    return (getSalesCreditNoteService() as any)[prop]
  },
})
