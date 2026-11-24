import {
  hasPermission,
  type PermissionSnapshot,
  type PermissionStatement,
} from "@avuny/contracts"
import type { PartyRole } from "@avuny/contracts/party"
import type { PartyAbilities } from "../types.js"

export function oppositeRole(role: PartyRole): PartyRole {
  return role === "CUSTOMER" ? "VENDOR" : "CUSTOMER"
}

export function isRoleActive(
  roles: readonly { role: PartyRole; isActive: boolean }[] = [],
  role: PartyRole
): boolean {
  const match = roles.find((r) => r.role === role)
  return match?.isActive === true
}

export function roleStatus(
  roles: readonly { role: PartyRole; isActive: boolean }[] = [],
  role: PartyRole
): "active" | "inactive" | "missing" {
  const match = roles.find((r) => r.role === role)
  if (!match) return "missing"
  return match.isActive ? "active" : "inactive"
}

function normalizeStatement(s: {
  effect?: string
  resource?: string
  action?: string
  resourceId?: string
}): PermissionStatement {
  return {
    effect: s.effect === "deny" ? "deny" : "allow",
    resource: (s.resource ?? "*") as PermissionStatement["resource"],
    action: (s.action ?? "*") as PermissionStatement["action"],
    resourceId: s.resourceId ?? "*",
  }
}

export interface PermissionSnapshotLike {
  isOwner?: boolean
  statements?: readonly {
    effect?: string
    resource?: string
    action?: string
    resourceId?: string
  }[]
}

export function derivePartyAbilities(
  snapshot: PermissionSnapshotLike | null | undefined,
  role: PartyRole
): PartyAbilities {
  const opposite = oppositeRole(role)
  const currentKey = role.toLowerCase()
  const oppKey = opposite.toLowerCase()

  if (!snapshot) {
    return {
      canRead: false,
      canCreate: false,
      canUpdate: false,
      canDelete: false,
      opposite: {
        role: opposite,
        canRead: false,
        canCreate: false,
        canUpdate: false,
      },
    }
  }

  const normalized: PermissionSnapshot = {
    isOwner: Boolean(snapshot.isOwner),
    statements: (snapshot.statements ?? []).map(normalizeStatement),
  }

  return {
    canRead: hasPermission(normalized, `read:${currentKey}`),
    canCreate: hasPermission(normalized, `create:${currentKey}`),
    canUpdate: hasPermission(normalized, `update:${currentKey}`),
    canDelete: hasPermission(normalized, `delete:${currentKey}`),
    opposite: {
      role: opposite,
      canRead: hasPermission(normalized, `read:${oppKey}`),
      canCreate: hasPermission(normalized, `create:${oppKey}`),
      canUpdate: hasPermission(normalized, `update:${oppKey}`),
    },
  }
}
