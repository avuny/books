import type { ActivityLog } from "./accounting.types.js"

/** Test double and placeholder: audit events are dropped. Production wiring uses the activity log module. */
export class DummyActivityLog implements ActivityLog {
  async log(): Promise<void> {}
}
