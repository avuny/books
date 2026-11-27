import type { PermissionKey } from "@avuny/contracts"

export const SALES_DELIVERY_PERMISSIONS = {
  CREATE: "create:sales-delivery",
  READ: "read:sales-delivery",
  UPDATE: "update:sales-delivery",
  DELETE: "delete:sales-delivery",
  POST: "post:sales-delivery",
  REVERSE: "reverse:sales-delivery",
} as const satisfies Record<string, PermissionKey>
