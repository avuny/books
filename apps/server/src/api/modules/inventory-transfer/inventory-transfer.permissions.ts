import type { PermissionKey } from "@avuny/contracts"

export const INVENTORY_TRANSFER_PERMISSIONS = {
  CREATE: "create:inventory-transfer",
  READ: "read:inventory-transfer",
  UPDATE: "update:inventory-transfer",
  DELETE: "delete:inventory-transfer",
  DISPATCH: "dispatch:inventory-transfer",
  RECEIVE: "receive:inventory-transfer",
  RETURN: "return:inventory-transfer",
  CLOSE_SHORT: "close_short:inventory-transfer",
  CANCEL: "cancel:inventory-transfer",
  REVERSE: "reverse:inventory-transfer",
} as const satisfies Record<string, PermissionKey>
