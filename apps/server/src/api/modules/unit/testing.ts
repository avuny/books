import type { ActivityLog, UnitPlanFeatures } from "./unit.types.js"

export class DummyUnitPlanFeatures implements UnitPlanFeatures {
  async has(): Promise<boolean> {
    return true
  }
}

export class DummyUnitActivityLog implements ActivityLog {
  async log(): Promise<void> {}
}
