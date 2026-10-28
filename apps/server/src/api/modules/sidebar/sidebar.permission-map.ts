import type { SidebarOptionName } from "@avuny/contracts"

/**
 * An option is visible when the user holds AT LEAST ONE of these actions on its resource.
 * Ordered by how likely they are to be granted so the gate can short-circuit early.
 * Add actions here if your permission catalog has more (e.g. "export", "manage").
 */
export const SIDEBAR_VISIBILITY_ACTIONS = ["read", "create", "update", "delete"] as const

/**
 * Sidebar option -> permission resource (the part after the colon in `action:resource`).
 * NOTE: the sidebar enum is camelCase, permission resources are kebab-case
 * (e.g. `read:organization-user`). Adjust any entry that differs in your permission catalog.
 */
export const sidebarOptionResources = {
  user: "user",
  role: "role",
  item: "item",
  unit: "unit",
  unitCollection: "unit-collection",
  invoice: "invoice",
  customer: "customer",
  supplier: "supplier",
  purchaseOrder: "purchase-order",
  salesOrder: "sales-order",
  warehouse: "warehouse",
  organization: "organization",
  organizationUser: "organization-user",
  report: "report",
  receipt: "receipt",
} as const satisfies Record<SidebarOptionName, string>

export interface SidebarPermissionMapper {
  /** Every `action:resource` key that makes this option visible. Unknown option -> [] (hidden). */
  keysFor(option: string): string[]
}

export function createSidebarPermissionMapper({
  resources = sidebarOptionResources as Record<string, string>,
  actions = SIDEBAR_VISIBILITY_ACTIONS as readonly string[],
}: {
  resources?: Record<string, string>
  actions?: readonly string[]
} = {}): SidebarPermissionMapper {
  return {
    keysFor(option) {
      const resource = resources[option]
      return resource ? actions.map((action) => `${action}:${resource}`) : []
    },
  }
}

export const sidebarPermissionMapper = createSidebarPermissionMapper()
