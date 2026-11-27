import {
  PLATFORM_MODULES,
  PLATFORM_PERMISSION_KEYS,
  type PlatformPermissionKey,
} from "./registry.js"

export interface PlatformBuiltinRoleDefinition {
  /** Stable identity: renaming creates a new role, so treat keys as frozen. */
  key: string
  name: string
  description: string
  permissions: readonly PlatformPermissionKey[]
}

/** Every read key of every resource. */
const READ_ALL = (
  Object.entries(PLATFORM_MODULES) as [string, readonly string[]][]
)
  .filter(([, actions]) => actions.includes("read"))
  .map(([resource]) => `read:${resource}` as PlatformPermissionKey)

const without = (
  keys: readonly PlatformPermissionKey[],
  drop: readonly string[]
): PlatformPermissionKey[] => keys.filter((k) => !drop.includes(k))

/**
 * Built-in platform roles (PLATFORM-ADMIN-SPEC 3.3, decision Q18). Seeded with
 * is_builtin = true; they can be viewed and cloned, not edited (PA-R5).
 * super_admin holds every key, including new ones the registry gains later.
 */
export const PLATFORM_BUILTIN_ROLES: readonly PlatformBuiltinRoleDefinition[] =
  [
    {
      key: "super_admin",
      name: "Super admin",
      description:
        "Owner. Everything, including managing admins and roles. Only a super admin can grant super admin (PA-R2).",
      permissions: PLATFORM_PERMISSION_KEYS,
    },
    {
      key: "catalog_manager",
      name: "Catalog manager",
      description:
        "Product and pricing: plans, features, add-ons and catalog display fields, read and write. Subscriptions read-only. Cannot apply plan changes to existing subscribers now (publish_now stays with super admin).",
      permissions: [
        "read:platform-plan",
        "create:platform-plan",
        "update:platform-plan",
        "publish:platform-plan",
        "retire:platform-plan",
        "read:platform-catalog",
        "update:platform-catalog",
        "read:platform-addon",
        "create:platform-addon",
        "update:platform-addon",
        "read:platform-plan-marketing",
        "update:platform-plan-marketing",
        "read:platform-subscription",
        "read:platform-dashboard",
      ],
    },
    {
      key: "billing_admin",
      name: "Billing admin",
      description:
        "Finance and operations: subscriptions, payments, refunds, manual payments and provider events, read and write. Plans read-only.",
      permissions: [
        "read:platform-subscription",
        "cancel:platform-subscription",
        "resume:platform-subscription",
        "change:platform-subscription",
        "read:platform-payment",
        "refund:platform-payment",
        "confirm_manual:platform-payment",
        "void_invoice:platform-payment",
        "read:platform-provider-event",
        "replay:platform-provider-event",
        "read:platform-plan",
        "read:platform-dashboard",
      ],
    },
    {
      key: "support",
      name: "Support",
      description:
        "Customer support: organizations, users, subscriptions and payments read-only; may extend trials and grant temporary overrides within limits.",
      permissions: [
        "read:platform-organization",
        "extend_trial:platform-organization",
        "override:platform-organization",
        "read:platform-user",
        "read:platform-subscription",
        "read:platform-payment",
        "read:platform-dashboard",
      ],
    },
    {
      key: "viewer",
      name: "Viewer",
      description:
        "Read-only everywhere except admin management (platform admins and roles) and audit export.",
      permissions: without(READ_ALL, [
        "read:platform-admin",
        "read:platform-role",
      ]),
    },
  ]
