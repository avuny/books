import type { PermissionKey } from "@avuny/contracts"

export const SALES_INVOICE_PERMISSIONS = {
  CREATE: "create:sales-invoice",
  READ: "read:sales-invoice",
  UPDATE: "update:sales-invoice",
  DELETE: "delete:sales-invoice",
  POST: "post:sales-invoice",
  REVERSE: "reverse:sales-invoice",
} as const satisfies Record<string, PermissionKey>
