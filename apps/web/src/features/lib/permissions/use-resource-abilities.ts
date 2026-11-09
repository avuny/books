import { useMemo } from "react"
import {
  hasPermission,
  type PermissionSnapshot,
  type PermissionStatement,
} from "@avuny/contracts"

import { useGetMyPermissions } from "@/api"

const NONE = { canRead: false, canCreate: false, canUpdate: false, canDelete: false }

function normalizeStatement(s: {
  effect?: "allow" | "deny" | string
  resource: string
  action: string
  resourceId?: string
}): PermissionStatement {
  return {
    effect: s.effect === "deny" ? "deny" : "allow",
    resource: s.resource as PermissionStatement["resource"],
    action: s.action as PermissionStatement["action"],
    resourceId: s.resourceId ?? "*",
  }
}

/**
 * What the signed-in user may do with one resource; used to show or hide buttons.
 * `resource` is the route-key form (hyphens): "item", "item-category", "unit".
 * Same data and rules as useRoleAbilities, shared so each module does not copy it.
 */
export function useResourceAbilities(orgId: string, resource: string) {
  const query = useGetMyPermissions(orgId)
  const snapshot = query.data?.data

  return useMemo(() => {
    if (!snapshot) return NONE
    const normalized: PermissionSnapshot = {
      isOwner: snapshot.isOwner,
      statements: snapshot.statements.map(normalizeStatement),
    }
    return {
      canRead: hasPermission(normalized, `read:${resource}`),
      canCreate: hasPermission(normalized, `create:${resource}`),
      canUpdate: hasPermission(normalized, `update:${resource}`),
      canDelete: hasPermission(normalized, `delete:${resource}`),
    }
  }, [snapshot, resource])
}
