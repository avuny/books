import type { PermissionKey } from "@avuny/contracts"

export const PURCHASE_RECEIPT_PERMISSIONS = {
  CREATE: "create:purchase-receipt",
  READ: "read:purchase-receipt",
  UPDATE: "update:purchase-receipt",
  DELETE: "delete:purchase-receipt",
  POST: "post:purchase-receipt",
  REVERSE: "reverse:purchase-receipt",
} as const satisfies Record<string, PermissionKey>
