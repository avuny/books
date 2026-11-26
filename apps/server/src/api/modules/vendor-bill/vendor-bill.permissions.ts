import type { PermissionKey } from "@avuny/contracts"

export const VENDOR_BILL_PERMISSIONS = {
  CREATE: "create:vendor-bill",
  READ: "read:vendor-bill",
  UPDATE: "update:vendor-bill",
  DELETE: "delete:vendor-bill",
  POST: "post:vendor-bill",
  REVERSE: "reverse:vendor-bill",
} as const satisfies Record<string, PermissionKey>
