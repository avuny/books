import type { PermissionKey } from "@avuny/contracts"

export const PURCHASE_SHIPMENT_PERMISSIONS = {
  CREATE: "create:purchase-shipment",
  READ: "read:purchase-shipment",
  UPDATE: "update:purchase-shipment",
  DELETE: "delete:purchase-shipment",
  POST: "post:purchase-shipment",
  REVERSE: "reverse:purchase-shipment",
} as const satisfies Record<string, PermissionKey>
