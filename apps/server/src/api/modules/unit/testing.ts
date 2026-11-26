import type { ActivityLog, ActivityLogEntry } from "./unit.types.js"

export class DummyUnitActivityLog implements ActivityLog {
  readonly entries: ActivityLogEntry[] = []
  async log(entry: ActivityLogEntry): Promise<void> {
    this.entries.push(entry)
  }
}

export { DummyPermissionChecker } from "../role/index.js"
