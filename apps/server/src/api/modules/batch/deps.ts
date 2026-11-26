import { db } from "../../db.js"
import { activityLogService } from "../activity-log/index.js"
import { createBatchRepository } from "./batch.repository.js"
import { createBatchService } from "./batch.service.js"
import type { BatchRepository, BatchService } from "./batch.types.js"

let _repo: BatchRepository | undefined
let _service: BatchService | undefined

export function getBatchRepository(): BatchRepository {
  return (_repo ??= createBatchRepository({ db }))
}

export function getBatchService(): BatchService {
  return (_service ??= createBatchService({
    repository: getBatchRepository(),
    activityLog: activityLogService,
  }))
}

export const batchService = new Proxy({} as BatchService, {
  get(_target, prop) {
    return (getBatchService() as any)[prop]
  },
})
