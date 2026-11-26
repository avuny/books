import type { Tx } from "@avuny/db"
import type {
  ActivityLog,
  Cache,
  OrganizationLimits,
} from "./organization.types.js"

export { DummyPermissionChecker } from "../role/index.js"

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

