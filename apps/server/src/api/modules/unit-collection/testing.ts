import type { ActivityLog, ActivityLogEntry, UnitCollectionPlanFeatures } from "./unit-collection.types.js"

export class DummyUnitCollectionPlanFeatures implements UnitCollectionPlanFeatures {
  constructor(private readonly allowed = true) {}
  async has(): Promise<boolean> {
    return this.allowed
  }
}

export class DummyUnitCollectionActivityLog implements ActivityLog {
  readonly entries: ActivityLogEntry[] = []
  async log(entry: ActivityLogEntry): Promise<void> {
    this.entries.push(entry)
  }
}

export { DummyPermissionChecker } from "../role/index.js"

