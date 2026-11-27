import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { matchesRegex, pk, timestamps } from "../_helpers.js"
import { platformAdmins } from "./admins.js"

/**
 * Permission key shape: `<action>:<resource>`, action snake_case, resource kebab-case
 * (for example `publish:platform-plan`, `export:platform-audit`). The closed list lives
 * in the `PLATFORM_MODULES` registry in @avuny/contracts (A1-03); the column stays plain
 * text so a registry change needs no migration, same idea as the tenant registry.
 */
export const PLATFORM_PERMISSION_KEY_PATTERN = "^[a-z][a-z0-9_]*:[a-z][a-z0-9-]*$"

/**
 * PLATFORM_ROLES: a named bundle of platform permissions (PLATFORM-ADMIN-SPEC 3.3).
 * Built-in roles (super_admin, catalog_manager, billing_admin, support, viewer) are
 * seeded from the registry and can be viewed and cloned, not edited (PA-R5).
 */
export const platformRoles = pgTable(
  "platform_roles",
  {
    id: pk(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    isBuiltin: boolean("is_builtin").notNull().default(false),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("platform_roles_key_uidx").on(t.key),
    check(
      "platform_roles_key_format_chk",
      matchesRegex(t.key, "^[a-z][a-z0-9_]*$")
    ),
    check(
      "platform_roles_name_chk",
      sql`char_length(${t.name}) between 1 and 100 and ${t.name} = btrim(${t.name})`
    ),
  ]
)

export type PlatformRoleRow = typeof platformRoles.$inferSelect
export type NewPlatformRoleRow = typeof platformRoles.$inferInsert

/**
 * PLATFORM_ROLE_PERMISSIONS: the permission keys a role grants. PA-R1 (only registry
 * keys) is enforced app-side against PLATFORM_MODULES; PA-R2 anti-escalation in the
 * service. Cascade: deleting a role drops its grants.
 */
export const platformRolePermissions = pgTable(
  "platform_role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => platformRoles.id, { onDelete: "cascade" }),
    permissionKey: text("permission_key").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.permissionKey] }),
    check(
      "platform_role_permissions_key_format_chk",
      matchesRegex(t.permissionKey, PLATFORM_PERMISSION_KEY_PATTERN)
    ),
  ]
)

export type PlatformRolePermission = typeof platformRolePermissions.$inferSelect
export type NewPlatformRolePermission =
  typeof platformRolePermissions.$inferInsert

/**
 * PLATFORM_ADMIN_ROLES: an admin can hold several roles; effective permissions are
 * the union (PLATFORM-ADMIN-SPEC 3.1).
 */
export const platformAdminRoles = pgTable(
  "platform_admin_roles",
  {
    adminId: uuid("admin_id")
      .notNull()
      .references(() => platformAdmins.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => platformRoles.id, { onDelete: "cascade" }),
    // Who granted this role (NULL for the bootstrap CLI). Supports PA-R2 audits.
    grantedBy: uuid("granted_by").references(() => platformAdmins.id, {
      onDelete: "set null",
    }),
  },
  (t) => [primaryKey({ columns: [t.adminId, t.roleId] })]
)

export type PlatformAdminRole = typeof platformAdminRoles.$inferSelect
export type NewPlatformAdminRole = typeof platformAdminRoles.$inferInsert
