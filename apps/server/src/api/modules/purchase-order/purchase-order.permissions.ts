import type { PermissionKey } from "@avuny/contracts"

export const PURCHASE_ORDER_PERMISSIONS = {
  CREATE: "create:purchase-order",
  READ: "read:purchase-order",
  UPDATE: "update:purchase-order",
  DELETE: "delete:purchase-order",
  CONFIRM: "confirm:purchase-order",
  CLOSE: "close:purchase-order",
  CANCEL: "cancel:purchase-order",
} as const satisfies Record<string, PermissionKey>
