import type {
  ActivityLog,
  Cache,
  PermissionChecker,
  PlanFeatures,
} from "./role.types.js"

export class DummyPlanFeatures implements PlanFeatures {
  async has(): Promise<boolean> {
    return true
  }
}

export class DummyActivityLog implements ActivityLog {
  async log(): Promise<void> {}
}

export class DummyCache implements Cache {
  async get<T>(): Promise<T | null> {
    return null
  }
  async set(): Promise<void> {}
  async del(): Promise<void> {}
}

export class DummyPermissionChecker implements PermissionChecker {
  async check(): Promise<boolean> {
    return true
  }
}
