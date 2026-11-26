import type { PermissionKey } from "@avuny/contracts"

export const VENDOR_PAYMENT_PERMISSIONS = {
  CREATE: "create:vendor-payment",
  READ: "read:vendor-payment",
  UPDATE: "update:vendor-payment",
  DELETE: "delete:vendor-payment",
  POST: "post:vendor-payment",
  REVERSE: "reverse:vendor-payment",
} as const satisfies Record<string, PermissionKey>
