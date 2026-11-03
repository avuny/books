// organization-user/testing.ts  (NEW)
// Test-only doubles, moved out of organization-user.service.ts. (DummyActivityLog now lives in activity-log/testing.ts.) Never import from production code,
// except the temporary TODO wiring in organization.composition.ts.
import type { Limits, PermissionChecker } from "./organization-user.service.js"

export class DummyPermissionChecker implements PermissionChecker {
  async check(): Promise<boolean> {
    return true
  }
}

export class DummyLimits implements Limits {
  async getMax(): Promise<number | null> {
    return null
  }
  async isChannelAllowed(): Promise<boolean> {
    return true
  }
}
