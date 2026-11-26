import type { PermissionKey } from "@avuny/contracts"

export const INVENTORY_ADJUSTMENT_PERMISSIONS = {
  CREATE: "create:inventory-adjustment",
  READ: "read:inventory-adjustment",
  UPDATE: "update:inventory-adjustment",
  DELETE: "delete:inventory-adjustment",
  CONFIRM: "confirm:inventory-adjustment",
  CANCEL: "cancel:inventory-adjustment",
} as const satisfies Record<string, PermissionKey>
