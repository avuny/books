import type { PermissionKey } from "@avuny/contracts"

export const SALES_CREDIT_NOTE_PERMISSIONS = {
  CREATE: "create:sales-credit-note",
  READ: "read:sales-credit-note",
  UPDATE: "update:sales-credit-note",
  DELETE: "delete:sales-credit-note",
  POST: "post:sales-credit-note",
  REVERSE: "reverse:sales-credit-note",
} as const satisfies Record<string, PermissionKey>
