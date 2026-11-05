import type { Tx } from "@avuny/db"
import type {
  ActivityLog,
  Cache,
  OrganizationLimits,
  PermissionChecker,
} from "./organization.types.js"

export class DummyPermissionChecker implements PermissionChecker {
  async check(): Promise<boolean> {
    return true
  }
}

export class DummyCache implements Cache {
  async get<T>(): Promise<T | null> {
    return null
  }
  async set(): Promise<void> {}
  async del(): Promise<void> {}
}

export class DummyActivityLog implements ActivityLog {
  async log(): Promise<void> {}
}

export class DummyOrganizationLimits implements OrganizationLimits {
  async maxOwnedPerUser(): Promise<number> {
    return 100
  }
}

