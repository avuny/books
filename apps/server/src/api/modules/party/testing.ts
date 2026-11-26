import type { ActivityLog } from "./party.types.js"
import type { PermissionChecker } from "./party.types.js"

export class DummyActivityLog implements ActivityLog {
  async log(): Promise<void> {}
}

export class DummyPermissionChecker implements PermissionChecker {
  private _allow: boolean
  constructor(allow = true) {
    this._allow = allow
  }
  async check(): Promise<boolean> {
    return this._allow
  }
}
