/**
 * THE registry of modules and actions. Add, rename or remove a module or action HERE;
 * every other list is derived from this file:
 *
 *   permissions   role/permission-catalog.ts  PERMISSION_CATALOG, PermissionKey, column types
 *   activity log  activity-log/constants.ts   ActivityLogAction, ACTIVITY_LOG_ACTIONS
 *   sidebar       sidebar/constants.ts        SIDEBAR_TREE, SidebarOptionName, labels, column types, seed
 *
 * A module (key = snake_case resource) lists its actions. One action feeds both facets:
 *   permission: true   a role can be granted `<action>:<module>`  (`deactivate:organization-user`)
 *   event: "name"      logged as `<module>.<name>`                (`organization_user.deactivated`)
 * They are independent: `read` is grantable but never logged; `join` is logged but cannot be
 * granted. Event names are explicit because audit rows keep them forever.
 *
 * Running the seed makes the database match this file; there is no migration to write:
 *   - sidebar tables and role_permissions store these names as plain text (typed from here),
 *     so an added, renamed or removed module/heading is inserted, updated or deleted by the seed;
 *   - labels are not stored at all, they are read from here at request time;
 *   - removing or renaming a module or action deletes its grants from EVERY role (custom ones
 *     too) at the next seed. Audit rows are append-only history and keep their old action
 *     strings, so never remove or rename an event that has shipped.
 */

export const LOCALES = ["en", "ar"] as const
export type Locale = (typeof LOCALES)[number]
export type Localized = Record<Locale, string>

/** Sidebar headings. Their order is the order of the sidebar. */
export const SIDEBAR_GROUPS = {
  users: { icon: "users", label: { en: "Users", ar: "المستخدمون" } },
  purchases: { icon: "shopping-cart", label: { en: "Purchases", ar: "المشتريات" } },
  sales: { icon: "badge-dollar-sign", label: { en: "Sales", ar: "المبيعات" } },
  inventory: { icon: "boxes", label: { en: "Inventory", ar: "المخزون" } },
} as const satisfies Record<string, { icon: string; label: Localized }>

export type SidebarGroup = keyof typeof SIDEBAR_GROUPS

export interface ActionSpec {
  /** A role can be granted this action on the module. */
  permission?: true
  /** Activity-log event name; logged as `<module>.<event>`. Omit if never logged. */
  event?: string
}

export interface SidebarSpec {
  group: SidebarGroup
  label: Localized
  /** Icon key understood by the web app (lucide names). */
  icon: string
  /** Org-relative path; the web app prefixes it with the active organization. */
  path: string
}

export interface ModuleSpec {
  actions: Readonly<Record<string, ActionSpec>>
  /** Having one puts the module in the sidebar (order: group order, then order in MODULES). */
  sidebar?: SidebarSpec
  /** Permission statements may be narrowed to one record through `resource_id`. */
  scopable?: boolean
}

const READ = { read: { permission: true } } as const

const CRUD = {
  create: { permission: true, event: "created" },
  read: { permission: true },
  update: { permission: true, event: "updated" },
  delete: { permission: true, event: "deleted" },
} as const

export const MODULES = {
  organization: {
    actions: {
      // Logged, not grantable: there is no organization yet to scope a role to.
      create: { event: "created" },
      read: { permission: true },
      update: { permission: true, event: "updated" },
      delete: { permission: true, event: "deleted" },
      transfer_ownership: { event: "ownership_transferred" },
    },
  },

  // -- users ---------------------------------------------------------------
  role: {
    sidebar: {
      group: "users",
      icon: "shield-check",
      path: "/roles",
      label: { en: "Roles", ar: "الأدوار" },
    },
    actions: {
      ...CRUD,
      // Granting is checked as `assign:role`; the change is logged on the member
      // (`organization_user.roles_changed`).
      assign: { permission: true },
    },
  },
  organization_user: {
    sidebar: {
      group: "users",
      icon: "users-round",
      path: "/users",
      label: { en: "Members", ar: "أعضاء المنظمة" },
    },
    actions: {
      read: { permission: true },
      update: { permission: true },
      deactivate: { permission: true, event: "deactivated" },
      reactivate: { event: "reactivated" },
      join: { event: "joined" },
      change_username: { event: "username_changed" },
      change_roles: { event: "roles_changed" },
    },
  },
  organization_invitation: {
    sidebar: {
      group: "users",
      icon: "mail",
      path: "/invitations",
      label: { en: "Organization invitations", ar: "دعوات المنظمة" },
    },
    actions: {
      create: { permission: true, event: "created" },
      read: { permission: true },
      update: { permission: true },
      resend: { event: "resent" },
      revoke: { event: "revoked" },
      accept: { event: "accepted" },
      decline: { event: "declined" },
    },
  },
  activity_log: { actions: READ },

  // -- purchases (standard CRUD assumed; adjust) ---------------------------
  // supplier: {
  //   sidebar: {
  //     group: "purchases",
  //     icon: "truck",
  //     path: "/suppliers",
  //     label: { en: "Suppliers", ar: "الموردون" },
  //   },
  //   actions: CRUD,
  // },
  // purchase_order: {
  //   sidebar: {
  //     group: "purchases",
  //     icon: "clipboard-list",
  //     path: "/purchase-orders",
  //     label: { en: "Purchase orders", ar: "أوامر الشراء" },
  //   },
  //   actions: CRUD,
  // },

  // // -- sales ---------------------------------------------------------------
  // customer: {
  //   sidebar: {
  //     group: "sales",
  //     icon: "contact",
  //     path: "/customers",
  //     label: { en: "Customers", ar: "العملاء" },
  //   },
  //   actions: CRUD,
  // },
  // sales_order: {
  //   sidebar: {
  //     group: "sales",
  //     icon: "shopping-bag",
  //     path: "/sales-orders",
  //     label: { en: "Sales orders", ar: "أوامر البيع" },
  //   },
  //   actions: CRUD,
  // },
  // invoice: {
  //   sidebar: {
  //     group: "sales",
  //     icon: "file-text",
  //     path: "/invoices",
  //     label: { en: "Invoices", ar: "الفواتير" },
  //   },
  //   actions: CRUD,
  // },
  // receipt: {
  //   sidebar: {
  //     group: "sales",
  //     icon: "receipt",
  //     path: "/receipts",
  //     label: { en: "Receipts", ar: "الإيصالات" },
  //   },
  //   actions: CRUD,
  // },
  // report: {
  //   sidebar: {
  //     group: "sales",
  //     icon: "chart-column",
  //     path: "/reports",
  //     label: { en: "Reports", ar: "التقارير" },
  //   },
  //   actions: READ,
  // },

  // -- inventory (events: mirror your item/unit/item-category constants) ---
  item: {
    sidebar: {
      group: "inventory",
      icon: "package",
      path: "/items",
      label: { en: "Items", ar: "الأصناف" },
    },
    actions: CRUD,
  },
  item_category: { actions: CRUD },
  unit: {
    sidebar: {
      group: "inventory",
      icon: "ruler",
      path: "/units",
      label: { en: "Units", ar: "الوحدات" },
    },
    actions: { ...CRUD, deactivate: { permission: true, event: "deactivated" } },
  },
  unit_collection: {
    sidebar: {
      group: "inventory",
      icon: "layers",
      path: "/unit-collections",
      label: { en: "Unit collections", ar: "مجموعات الوحدات" },
    },
    actions: CRUD,
  },
  warehouse: {
    sidebar: {
      group: "inventory",
      icon: "warehouse",
      path: "/warehouses",
      label: { en: "Warehouses", ar: "المستودعات" },
    },
    actions: {
      ...CRUD,
      deactivate: { permission: true, event: "deactivated" },
      reactivate: { event: "reactivated" },
      set_default: { event: "default_changed" },
    },
  },
  warehouse_location: {
    actions: {
      ...CRUD,
      bulk_create: { event: "bulk_created" },
      move: { permission: true, event: "moved" },
      block: { permission: true, event: "blocked" },
      unblock: { event: "unblocked" },
      deactivate: { permission: true, event: "deactivated" },
      reactivate: { event: "reactivated" },
      change_barcode: { permission: true, event: "barcode_changed" },
    },
  },
} as const satisfies Record<string, ModuleSpec>
