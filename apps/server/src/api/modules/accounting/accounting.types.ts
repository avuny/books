import type { AccountingErrorCode, ActivityLogAction } from "@avuny/contracts"
import type { ActivityLog, ActivityLogEntry } from "../activity-log/activity-log.port.js"
import type { createAccountingRepository } from "./accounting.repository.js"
import type { createAccountingService } from "./accounting.service.js"

export type AccountingRepository = ReturnType<typeof createAccountingRepository>
export type AccountingService = ReturnType<typeof createAccountingService>

export type Code = AccountingErrorCode

export type { ActivityLog, ActivityLogEntry, ActivityLogAction }

export interface AccountingServiceDeps {
  repository: AccountingRepository
  /** Optional port; defaults to a no-op. Called only after the outermost transaction committed. */
  activityLog?: ActivityLog
  /** Clock for "today" in reports and for closedAt; injectable so tests are deterministic. */
  now?: () => Date
}
