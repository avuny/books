/**
 * MUST stay in sync with the pgEnums in packages/db/src/schema/sidebar/sidebar.ts
 * (sidebar.service.spec.ts asserts the parity).
 * Order matters: Postgres sorts enum columns by declaration order, and the
 * sidebar is ordered by it.
 */
export const SidebarHeadingType = ["users", "purchases", "sales", "inventory"] as const
export type SidebarHeadingType = (typeof SidebarHeadingType)[number]

export const SidebarOptionName = [
  "user",
  "role",
  "item",
  "unit",
  "unitCollection",
  "invoice",
  "customer",
  "supplier",
  "purchaseOrder",
  "salesOrder",
  "warehouse",
  "organization",
  "organizationUser",
  "report",
  "receipt",
] as const
export type SidebarOptionName = (typeof SidebarOptionName)[number]
