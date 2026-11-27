import type { PermissionKey } from "@avuny/contracts"

export const CUSTOMER_PAYMENT_PERMISSIONS = {
  CREATE: "create:customer-payment",
  READ: "read:customer-payment",
  UPDATE: "update:customer-payment",
  DELETE: "delete:customer-payment",
  POST: "post:customer-payment",
  REVERSE: "reverse:customer-payment",
} as const satisfies Record<string, PermissionKey>
