// Test-only doubles. Never import from production code.
import type { ActivityLog, ActivityLogEntry } from "./activity-log.port.js"

export class DummyActivityLog implements ActivityLog {
  async log(): Promise<void> {}
}

/** Collects entries so a test can assert what a service logged. */
export class InMemoryActivityLog implements ActivityLog {
  readonly entries: ActivityLogEntry[] = []
  async log(entry: ActivityLogEntry): Promise<void> {
    this.entries.push(entry)
  }
}
