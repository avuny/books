import { and, asc, eq, ilike, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm"
import {
  organizationUserRoles,
  organizationUsers,
  rolePermissions,
  roles,
  type DB,
  type OrganizationUser,
  type Role,
  type Tx,
} from "@avuny/db"
import type { PermissionStatement } from "@avuny/contracts"
import { isForeignKeyViolation, isUniqueViolation } from "../shared/pg-errors.js"

// Index names from the roles schema
const ROLE_NAME_INDEXES = ["ux_role_org_name", "ux_role_system_name"] as const

type NewRole = typeof roles.$inferInsert

export type RoleWriteResult =
  | { ok: true; row: Role }
  | { ok: false; reason: "name_taken" | "not_found" }

export type ListRolesFilter = {
  scope: "all" | "system" | "custom"
  search?: string
  page: number
  pageSize: number
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`)
/** System roles plus the organization's own roles. */
const visibleTo = (orgId: string) => or(isNull(roles.orgId), eq(roles.orgId, orgId))!

/** Pure Drizzle access for roles, role_permissions and organization_user_roles. */
export function createRoleRepository({ db }: { db: DB }) {
  const exec = (tx?: Tx): DB | Tx => tx ?? db

  return {
    transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      return db.transaction(fn)
    },

    /** Serializes role writes and assignments of one organization (name checks, in-use checks). */
    async lockOrgRoles(orgId: string, tx: Tx): Promise<void> {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`org_roles:${orgId}`}, 0))`
      )
    },

    /* ----- roles ----- */

    async findVisibleById(orgId: string, roleId: string, tx?: Tx): Promise<Role | null> {
      const [row] = await exec(tx)
        .select()
        .from(roles)
        .where(and(eq(roles.id, roleId), visibleTo(orgId)))
        .limit(1)
      return row ?? null
    },

    async findVisibleByIds(orgId: string, ids: string[], tx?: Tx): Promise<Role[]> {
      if (!ids.length) return []
      return exec(tx)
        .select()
        .from(roles)
        .where(and(inArray(roles.id, ids), visibleTo(orgId)))
    },

    /** Case-insensitive; system role names are reserved for every organization. */
    async nameTaken(
      orgId: string,
      name: string,
      excludeId: string | undefined,
      tx?: Tx
    ): Promise<boolean> {
      const conditions: SQL[] = [
        visibleTo(orgId),
        sql`lower(${roles.name}) = lower(${name})`,
      ]
      if (excludeId) conditions.push(ne(roles.id, excludeId))
      const [row] = await exec(tx)
        .select({ id: roles.id })
        .from(roles)
        .where(and(...conditions))
        .limit(1)
      return !!row
    },

    async list(
      orgId: string,
      f: ListRolesFilter,
      tx?: Tx
    ): Promise<{
      rows: { role: Role; permissionCount: number; memberCount: number }[]
      total: number
    }> {
      const conditions: SQL[] = [visibleTo(orgId)]
      if (f.scope === "system") conditions.push(isNull(roles.orgId))
      if (f.scope === "custom") conditions.push(eq(roles.orgId, orgId))
      if (f.search) conditions.push(ilike(roles.name, `%${escapeLike(f.search)}%`))
      const where = and(...conditions)

      const rows = await exec(tx)
        .select({
          role: roles,
          permissionCount: sql<number>`(select count(*)::int from ${rolePermissions} where ${rolePermissions.roleId} = ${roles.id})`,
          memberCount: sql<number>`(select count(*)::int from ${organizationUserRoles} where ${organizationUserRoles.roleId} = ${roles.id} and ${organizationUserRoles.orgId} = ${orgId})`,
        })
        .from(roles)
        .where(where)
        .orderBy(sql`${roles.orgId} is not null`, asc(roles.name)) // system roles first
        .limit(f.pageSize)
        .offset((f.page - 1) * f.pageSize)
      const [counted] = await exec(tx)
        .select({ total: sql<number>`count(*)::int` })
        .from(roles)
        .where(where)
      return { rows, total: counted?.total ?? 0 }
    },

    async insertRole(values: NewRole, tx?: Tx): Promise<RoleWriteResult> {
      try {
        const [row] = await exec(tx).insert(roles).values(values).returning()
        return row ? { ok: true, row } : { ok: false, reason: "not_found" }
      } catch (err) {
        if (isUniqueViolation(err, ROLE_NAME_INDEXES))
          return { ok: false, reason: "name_taken" }
        throw err
      }
    },

    async updateRole(
      roleId: string,
      patch: { name?: string; description?: string | null },
      tx?: Tx
    ): Promise<RoleWriteResult> {
      try {
        const [row] = await exec(tx)
          .update(roles)
          .set({ ...patch, updatedAt: new Date() }) // always bump, also for permission-only edits
          .where(eq(roles.id, roleId))
          .returning()
        return row ? { ok: true, row } : { ok: false, reason: "not_found" }
      } catch (err) {
        if (isUniqueViolation(err, ROLE_NAME_INDEXES))
          return { ok: false, reason: "name_taken" }
        throw err
      }
    },

    async deleteRole(
      orgId: string,
      roleId: string,
      tx?: Tx
    ): Promise<{ ok: true } | { ok: false; reason: "in_use" | "not_found" }> {
      try {
        const rows = await exec(tx)
          .delete(roles)
          .where(and(eq(roles.id, roleId), eq(roles.orgId, orgId)))
          .returning({ id: roles.id })
        return rows.length ? { ok: true } : { ok: false, reason: "not_found" }
      } catch (err) {
        if (isForeignKeyViolation(err)) return { ok: false, reason: "in_use" }
        throw err
      }
    },

    /* ----- statements ----- */

    async listStatements(roleId: string, tx?: Tx): Promise<PermissionStatement[]> {
      return exec(tx)
        .select({
          effect: rolePermissions.effect,
          resource: rolePermissions.resource,
          action: rolePermissions.action,
          resourceId: rolePermissions.resourceId,
        })
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, roleId))
        .orderBy(asc(rolePermissions.resource), asc(rolePermissions.action))
    },

    async listStatementsForRoles(
      roleIds: string[],
      tx?: Tx
    ): Promise<Map<string, PermissionStatement[]>> {
      const byRole = new Map<string, PermissionStatement[]>()
      if (!roleIds.length) return byRole
      const rows = await exec(tx)
        .select({
          roleId: rolePermissions.roleId,
          effect: rolePermissions.effect,
          resource: rolePermissions.resource,
          action: rolePermissions.action,
          resourceId: rolePermissions.resourceId,
        })
        .from(rolePermissions)
        .where(inArray(rolePermissions.roleId, roleIds))
      for (const { roleId, ...s } of rows) {
        const list = byRole.get(roleId) ?? []
        list.push(s)
        byRole.set(roleId, list)
      }
      return byRole
    },

    /** Full replace: a role's statements are small and have no outside references. */
    async replaceStatements(
      roleId: string,
      statements: readonly PermissionStatement[],
      tx?: Tx
    ): Promise<void> {
      await exec(tx).delete(rolePermissions).where(eq(rolePermissions.roleId, roleId))
      if (statements.length)
        await exec(tx)
          .insert(rolePermissions)
          .values(statements.map((s) => ({ roleId, ...s })))
    },

    /* ----- assignments ----- */

    async countAssignments(roleId: string, tx?: Tx): Promise<number> {
      const [row] = await exec(tx)
        .select({ total: sql<number>`count(*)::int` })
        .from(organizationUserRoles)
        .where(eq(organizationUserRoles.roleId, roleId))
      return row?.total ?? 0
    },

    async countOrgAssignments(orgId: string, roleId: string, tx?: Tx): Promise<number> {
      const [row] = await exec(tx)
        .select({ total: sql<number>`count(*)::int` })
        .from(organizationUserRoles)
        .where(
          and(eq(organizationUserRoles.roleId, roleId), eq(organizationUserRoles.orgId, orgId))
        )
      return row?.total ?? 0
    },

    async findMember(orgId: string, memberId: string, tx?: Tx): Promise<OrganizationUser | null> {
      const [row] = await exec(tx)
        .select()
        .from(organizationUsers)
        .where(and(eq(organizationUsers.orgId, orgId), eq(organizationUsers.id, memberId)))
        .limit(1)
      return row ?? null
    },

    async findMembership(orgId: string, userId: string, tx?: Tx): Promise<OrganizationUser | null> {
      const [row] = await exec(tx)
        .select()
        .from(organizationUsers)
        .where(and(eq(organizationUsers.orgId, orgId), eq(organizationUsers.userId, userId)))
        .limit(1)
      return row ?? null
    },

    async listMemberRoles(orgUserId: string, tx?: Tx): Promise<Role[]> {
      const rows = await exec(tx)
        .select({ role: roles })
        .from(organizationUserRoles)
        .innerJoin(roles, eq(roles.id, organizationUserRoles.roleId))
        .where(eq(organizationUserRoles.orgUserId, orgUserId))
        .orderBy(asc(roles.name))
      return rows.map((r) => r.role)
    },

    /** Effective statements of a member = union over all their roles. */
    async listStatementsForMember(orgUserId: string, tx?: Tx): Promise<PermissionStatement[]> {
      return exec(tx)
        .select({
          effect: rolePermissions.effect,
          resource: rolePermissions.resource,
          action: rolePermissions.action,
          resourceId: rolePermissions.resourceId,
        })
        .from(organizationUserRoles)
        .innerJoin(rolePermissions, eq(rolePermissions.roleId, organizationUserRoles.roleId))
        .where(eq(organizationUserRoles.orgUserId, orgUserId))
    },

    async listAssignedOrgUserIds(roleId: string, tx?: Tx): Promise<string[]> {
      const rows = await exec(tx)
        .select({ id: organizationUserRoles.orgUserId })
        .from(organizationUserRoles)
        .where(eq(organizationUserRoles.roleId, roleId))
      return rows.map((r) => r.id)
    },

    async applyMemberRoles(
      p: {
        orgId: string
        orgUserId: string
        add: string[]
        remove: string[]
        assignedByUserId: string
      },
      tx?: Tx
    ): Promise<void> {
      if (p.remove.length)
        await exec(tx)
          .delete(organizationUserRoles)
          .where(
            and(
              eq(organizationUserRoles.orgUserId, p.orgUserId),
              inArray(organizationUserRoles.roleId, p.remove)
            )
          )
      if (p.add.length)
        await exec(tx)
          .insert(organizationUserRoles)
          .values(
            p.add.map((roleId) => ({
              orgId: p.orgId,
              orgUserId: p.orgUserId,
              roleId,
              assignedByUserId: p.assignedByUserId,
            }))
          )
          .onConflictDoNothing()
    },
  }
}

export type RoleRepository = ReturnType<typeof createRoleRepository>
