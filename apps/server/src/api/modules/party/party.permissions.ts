import type { PermissionKey } from "@avuny/contracts"

export const PARTY_PERMISSIONS = {
  CUSTOMER: {
    CREATE: "create:customer" satisfies PermissionKey,
    READ: "read:customer" satisfies PermissionKey,
    UPDATE: "update:customer" satisfies PermissionKey,
    DELETE: "delete:customer" satisfies PermissionKey,
  },
  VENDOR: {
    CREATE: "create:vendor" satisfies PermissionKey,
    READ: "read:vendor" satisfies PermissionKey,
    UPDATE: "update:vendor" satisfies PermissionKey,
    DELETE: "delete:vendor" satisfies PermissionKey,
  },
} as const satisfies Record<string, Record<string, PermissionKey>>
