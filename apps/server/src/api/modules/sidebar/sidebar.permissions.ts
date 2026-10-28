// ASSUMPTION: role/index.ts re-exports `permissionChecker` and `PermissionChecker`
// (they live in role.permissions.ts). If not, export them from the role module's index.
import { permissionChecker, type PermissionChecker } from "../role/index.js"

export interface SidebarPermissionSubject {
  userId: string
  orgId: string
}

/** Port: "does this user hold at least one of these permission keys in this org?" */
export interface SidebarPermissionGate {
  hasAny(subject: SidebarPermissionSubject, keys: readonly string[]): Promise<boolean>
}

/** Out-of-the-box fallback (AGENTS.md convention). NEVER wire this in production. */
export class DummyPermissionGate implements SidebarPermissionGate {
  async hasAny(): Promise<boolean> {
    return true
  }
}

/**
 * Adapter over the role module's PermissionChecker. Owners/managed-member/deny rules
 * are all enforced by the checker; we only ask "any of these keys?" and stop at the
 * first hit.
 */
export function createPermissionCheckerGate(
  checker: PermissionChecker = permissionChecker
): SidebarPermissionGate {
  return {
    async hasAny({ userId, orgId }, keys) {
      for (const key of keys) {
        if (await checker.check({ userId }, key, { orgId })) return true
      }
      return false
    },
  }
}
