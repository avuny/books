import type {
  ActivityLog,
  Limits,
} from "./organization-user.types.js"

export { DummyPermissionChecker } from "../role/index.js"

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