import type {
  ActivityLog,
  Limits,
  PermissionChecker,
} from "./organization-user.types.js"

export class DummyPermissionChecker implements PermissionChecker {
  async check(): Promise<boolean> {
    return true
  }
}

export class DummyActivityLog implements ActivityLog {
  async log(): Promise<void> {}
}

export class DummyLimits implements Limits {
  async getMax(): Promise<number | null> {
    return null
  }
  async isChannelAllowed(): Promise<boolean> {
    return true
  }
}