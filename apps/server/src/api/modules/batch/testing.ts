import type { ActivityLog } from "./batch.types.js"

export class DummyBatchActivityLog implements ActivityLog {
  async log(): Promise<void> {}
}
