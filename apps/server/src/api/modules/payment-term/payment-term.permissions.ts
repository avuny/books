import type { PermissionKey } from "@avuny/contracts"

export const PAYMENT_TERM_PERMISSIONS = {
  CREATE: "create:payment-term",
  READ: "read:payment-term",
  UPDATE: "update:payment-term",
} as const satisfies Record<string, PermissionKey>
