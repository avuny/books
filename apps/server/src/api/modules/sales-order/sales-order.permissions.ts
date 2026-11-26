import type { PermissionKey } from "@avuny/contracts"

export const SALES_ORDER_PERMISSIONS = {
  CREATE: "create:sales-order",
  READ: "read:sales-order",
  UPDATE: "update:sales-order",
  DELETE: "delete:sales-order",
  CONFIRM: "confirm:sales-order",
  CLOSE: "close:sales-order",
  CANCEL: "cancel:sales-order",
} as const satisfies Record<string, PermissionKey>
