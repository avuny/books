import type { PermissionKey } from "@avuny/contracts"

/** Permission strings checked by the warehouse-location service (`<action>:<route-key resource>`). */
export const WAREHOUSE_LOCATION_PERMISSIONS = {
  CREATE: "create:warehouse-location",
  READ: "read:warehouse-location",
  UPDATE: "update:warehouse-location",
  DELETE: "delete:warehouse-location",
  // Reactivate reuses deactivate, bulk create reuses create, unblock reuses block (logged-only actions).
  DEACTIVATE: "deactivate:warehouse-location",
  MOVE: "move:warehouse-location",
  BLOCK: "block:warehouse-location",
  CHANGE_BARCODE: "change_barcode:warehouse-location",
} as const satisfies Record<string, PermissionKey>
