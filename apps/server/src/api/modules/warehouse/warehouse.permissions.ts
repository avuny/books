import type { PermissionKey } from "@avuny/contracts"

/** Permission strings checked by the warehouse service (`<action>:<route-key resource>`). */
export const WAREHOUSE_PERMISSIONS = {
  CREATE: "create:warehouse",
  READ: "read:warehouse",
  UPDATE: "update:warehouse",
  DELETE: "delete:warehouse",
  // Reactivation and set-default are logged-only actions in the registry: they reuse these.
  DEACTIVATE: "deactivate:warehouse",
} as const satisfies Record<string, PermissionKey>
