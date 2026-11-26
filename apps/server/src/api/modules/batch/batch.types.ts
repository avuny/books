import type { BatchErrorCode } from "@avuny/contracts"
import type { ActivityLog, ActivityLogEntry } from "../activity-log/activity-log.port.js"
import type { createBatchRepository } from "./batch.repository.js"
import type { createBatchService } from "./batch.service.js"

export type BatchRepository = ReturnType<typeof createBatchRepository>
export type BatchService = ReturnType<typeof createBatchService>
export type Code = BatchErrorCode
export type { ActivityLog, ActivityLogEntry }

export interface BatchServiceDeps {
  repository: BatchRepository
  activityLog?: ActivityLog // optional port; defaults to a no-op
}
