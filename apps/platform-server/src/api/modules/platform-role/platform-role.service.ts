import { asc, count, eq, sql } from "@avuny/db"
import {
  platformAdminRoles,
  platformRolePermissions,
  platformRoles,
  type DB,
  type PlatformAdmin,
  type PlatformRoleRow,
} from "@avuny/db"
import {
  findInvalidPlatformPermission,
  PLATFORM_AUDIT_ACTIONS,
  PlatformManagementErrorCode as Code,
  type PlatformRoleDto,
} from "@avuny/contracts/platform-admin"
import { fail, ok, type Result } from "@avuny/utils"
import { writePlatformAudit } from "../platform-auth/platform-auth.audit.js"
import { loadEffectivePermissions } from "../platform-auth/platform-auth.middleware.js"
import type { RequestContext } from "../platform-auth/platform-auth.service.js"

/**
 * Platform role management (A1-05, PLATFORM-ADMIN-SPEC 3.3): list, create,
 * update, delete and clone. PA-R1 (registry-only keys) and PA-R2 (a role can
 * only carry permissions the caller holds) are enforced here; PA-R5 locks
 * built-in roles from edit and delete, and ROLE_IN_USE is enforced by a guarded
 * single DELETE so it holds under concurrent grants.
 */

type RoleResult<T, E extends string> = Result<T, E>

async function toRoleDto(db: DB, role: PlatformRoleRow): Promise<PlatformRoleDto> {
  const grants = await db
    .select({ permissionKey: platformRolePermissions.permissionKey })
    .from(platformRolePermissions)
    .where(eq(platformRolePermissions.roleId, role.id))
  const [heldBy] = await db
    .select({ value: count() })
    .from(platformAdminRoles)
    .where(eq(platformAdminRoles.roleId, role.id))
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    isBuiltin: role.isBuiltin,
    permissions: grants.map((grant) => grant.permissionKey).sort(),
    adminCount: heldBy?.value ?? 0,
    createdAt: role.createdAt.toISOString(),
  }
}

/** PA-R1: every key must exist in the registry, no duplicates. */
function validatePermissionKeys(
  permissions: string[]
): RoleResult<null, typeof Code.INVALID_PERMISSIONS> {
  const invalid = findInvalidPlatformPermission(permissions)
  if (invalid) {
    return fail({
      error: Code.INVALID_PERMISSIONS,
      msg: `Unknown platform permission: ${invalid}`,
    })
  }
  if (new Set(permissions).size !== permissions.length) {
    return fail({ error: Code.INVALID_PERMISSIONS, msg: "Duplicate permissions" })
  }
  return ok({ data: null })
}

/** PA-R2: a role can only carry permissions the caller holds themselves. */
async function assertWithinOwnPermissions(
  db: DB,
  callerId: string,
  permissions: string[]
): Promise<RoleResult<null, typeof Code.ESCALATION_DENIED>> {
  const own = await loadEffectivePermissions(db, callerId)
  for (const permission of permissions) {
    if (!own.has(permission)) {
      return fail({
        error: Code.ESCALATION_DENIED,
        msg: `Cannot grant ${permission}`,
      })
    }
  }
  return ok({ data: null })
}

/** A duplicate key is a constraint race: pre-check first, then catch it. */
const isRoleKeyViolation = (error: unknown): boolean =>
  error instanceof Error &&
  (error.message.includes("platform_roles_key_uidx") ||
    (error as { code?: string }).code === "23505")

/* -------------------------------------------------------------------- list */

export async function listRoles(db: DB): Promise<PlatformRoleDto[]> {
  const roles = await db
    .select()
    .from(platformRoles)
    .orderBy(asc(platformRoles.key))
  const dtos: PlatformRoleDto[] = []
  for (const role of roles) dtos.push(await toRoleDto(db, role))
  return dtos
}

export async function getRole(
  db: DB,
  roleId: string
): Promise<RoleResult<PlatformRoleDto, typeof Code.ROLE_NOT_FOUND>> {
  const [role] = await db
    .select()
    .from(platformRoles)
    .where(eq(platformRoles.id, roleId))
    .limit(1)
  if (!role) return fail({ error: Code.ROLE_NOT_FOUND, msg: "No such role" })
  return ok({ data: await toRoleDto(db, role) })
}

/* ------------------------------------------------------------------ create */

export async function createRole(
  db: DB,
  caller: PlatformAdmin,
  input: { key: string; name: string; description?: string; permissions: string[] },
  ctx: RequestContext
): Promise<
  RoleResult<
    PlatformRoleDto,
    | typeof Code.INVALID_PERMISSIONS
    | typeof Code.ROLE_KEY_TAKEN
    | typeof Code.ESCALATION_DENIED
  >
> {
  const valid = validatePermissionKeys(input.permissions)
  if (!valid.success) return valid
  const within = await assertWithinOwnPermissions(db, caller.id, input.permissions)
  if (!within.success) return within

  const [taken] = await db
    .select({ id: platformRoles.id })
    .from(platformRoles)
    .where(eq(platformRoles.key, input.key))
    .limit(1)
  if (taken) {
    return fail({ error: Code.ROLE_KEY_TAKEN, msg: "Role key already exists" })
  }

  let role: PlatformRoleRow | undefined
  try {
    ;[role] = await db
      .insert(platformRoles)
      .values({
        key: input.key,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        isBuiltin: false,
      })
      .returning()
  } catch (error) {
    if (isRoleKeyViolation(error)) {
      return fail({ error: Code.ROLE_KEY_TAKEN, msg: "Role key already exists" })
    }
    throw error
  }
  if (input.permissions.length > 0) {
    await db.insert(platformRolePermissions).values(
      input.permissions.map((permissionKey) => ({
        roleId: role!.id,
        permissionKey,
      }))
    )
  }

  await writePlatformAudit(db, {
    adminId: caller.id,
    action: PLATFORM_AUDIT_ACTIONS.ROLE_CREATED,
    resource: "platform-role",
    resourceId: role!.id,
    after: { key: role!.key, permissions: input.permissions },
    ipAddress: ctx.ipAddress,
  })
  return ok({ data: await toRoleDto(db, role!) })
}

/* ------------------------------------------------------------------ update */

export async function updateRole(
  db: DB,
  caller: PlatformAdmin,
  roleId: string,
  input: {
    name?: string
    description?: string | null
    permissions?: string[]
  },
  ctx: RequestContext
): Promise<
  RoleResult<
    PlatformRoleDto,
    | typeof Code.ROLE_NOT_FOUND
    | typeof Code.BUILTIN_ROLE_LOCKED
    | typeof Code.INVALID_PERMISSIONS
    | typeof Code.ESCALATION_DENIED
  >
> {
  const [role] = await db
    .select()
    .from(platformRoles)
    .where(eq(platformRoles.id, roleId))
    .limit(1)
  if (!role) return fail({ error: Code.ROLE_NOT_FOUND, msg: "No such role" })
  if (role.isBuiltin) {
    return fail({
      error: Code.BUILTIN_ROLE_LOCKED,
      msg: "Built-in roles can be viewed and cloned, not edited",
    })
  }
  if (input.permissions) {
    const valid = validatePermissionKeys(input.permissions)
    if (!valid.success) return valid
    const within = await assertWithinOwnPermissions(
      db,
      caller.id,
      input.permissions
    )
    if (!within.success) return within
  }

  const before = await toRoleDto(db, role)
  const [updated] = await db
    .update(platformRoles)
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined
        ? {
            description:
              input.description === null ? null : input.description.trim(),
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(platformRoles.id, roleId))
    .returning()
  if (input.permissions) {
    await db
      .delete(platformRolePermissions)
      .where(eq(platformRolePermissions.roleId, roleId))
    if (input.permissions.length > 0) {
      await db.insert(platformRolePermissions).values(
        input.permissions.map((permissionKey) => ({
          roleId,
          permissionKey,
        }))
      )
    }
  }

  await writePlatformAudit(db, {
    adminId: caller.id,
    action: PLATFORM_AUDIT_ACTIONS.ROLE_UPDATED,
    resource: "platform-role",
    resourceId: roleId,
    before: {
      name: before.name,
      description: before.description,
      permissions: before.permissions,
    },
    after: {
      name: updated!.name,
      description: updated!.description,
      permissions: input.permissions ?? before.permissions,
    },
    ipAddress: ctx.ipAddress,
  })
  return ok({ data: await toRoleDto(db, updated!) })
}

/* ------------------------------------------------------------------ delete */

export async function deleteRole(
  db: DB,
  caller: PlatformAdmin,
  roleId: string,
  ctx: RequestContext
): Promise<
  RoleResult<
    null,
    | typeof Code.ROLE_NOT_FOUND
    | typeof Code.BUILTIN_ROLE_LOCKED
    | typeof Code.ROLE_IN_USE
  >
> {
  const [role] = await db
    .select()
    .from(platformRoles)
    .where(eq(platformRoles.id, roleId))
    .limit(1)
  if (!role) return fail({ error: Code.ROLE_NOT_FOUND, msg: "No such role" })
  if (role.isBuiltin) {
    return fail({
      error: Code.BUILTIN_ROLE_LOCKED,
      msg: "Built-in roles can be viewed and cloned, not edited",
    })
  }

  // Race-safe: the delete only applies while no admin holds the role, so a
  // grant landing concurrently turns this into ROLE_IN_USE instead of a
  // dangling assignment (the FK cascade would silently drop the grant).
  const removed = await db.execute<{ id: string }>(sql`
    delete from platform_roles
    where id = ${roleId}
      and not exists (
        select 1 from platform_admin_roles ar where ar.role_id = ${roleId}
      )
    returning id
  `)
  if (removed.rows.length === 0) {
    return fail({
      error: Code.ROLE_IN_USE,
      msg: "Role is still assigned to at least one admin",
    })
  }

  await writePlatformAudit(db, {
    adminId: caller.id,
    action: PLATFORM_AUDIT_ACTIONS.ROLE_DELETED,
    resource: "platform-role",
    resourceId: roleId,
    before: { key: role.key },
    ipAddress: ctx.ipAddress,
  })
  return ok({ data: null })
}

/* ------------------------------------------------------------------- clone */

export async function cloneRole(
  db: DB,
  caller: PlatformAdmin,
  roleId: string,
  input: { key: string; name: string; description?: string },
  ctx: RequestContext
): Promise<
  RoleResult<
    PlatformRoleDto,
    | typeof Code.ROLE_NOT_FOUND
    | typeof Code.ROLE_KEY_TAKEN
    | typeof Code.ESCALATION_DENIED
  >
> {
  const [source] = await db
    .select()
    .from(platformRoles)
    .where(eq(platformRoles.id, roleId))
    .limit(1)
  if (!source) return fail({ error: Code.ROLE_NOT_FOUND, msg: "No such role" })

  const grants = await db
    .select({ permissionKey: platformRolePermissions.permissionKey })
    .from(platformRolePermissions)
    .where(eq(platformRolePermissions.roleId, roleId))
  const permissions = grants.map((grant) => grant.permissionKey)
  // PA-R2 applies to the copy too: cloning super_admin requires holding
  // every permission it carries.
  const within = await assertWithinOwnPermissions(db, caller.id, permissions)
  if (!within.success) return within

  const [taken] = await db
    .select({ id: platformRoles.id })
    .from(platformRoles)
    .where(eq(platformRoles.key, input.key))
    .limit(1)
  if (taken) {
    return fail({ error: Code.ROLE_KEY_TAKEN, msg: "Role key already exists" })
  }

  let role: PlatformRoleRow | undefined
  try {
    ;[role] = await db
      .insert(platformRoles)
      .values({
        key: input.key,
        name: input.name.trim(),
        description: input.description?.trim() ?? source.description,
        isBuiltin: false,
      })
      .returning()
  } catch (error) {
    if (isRoleKeyViolation(error)) {
      return fail({ error: Code.ROLE_KEY_TAKEN, msg: "Role key already exists" })
    }
    throw error
  }
  if (permissions.length > 0) {
    await db.insert(platformRolePermissions).values(
      permissions.map((permissionKey) => ({ roleId: role!.id, permissionKey }))
    )
  }

  await writePlatformAudit(db, {
    adminId: caller.id,
    action: PLATFORM_AUDIT_ACTIONS.ROLE_CREATED,
    resource: "platform-role",
    resourceId: role!.id,
    after: { key: role!.key, clonedFrom: source.key, permissions },
    ipAddress: ctx.ipAddress,
  })
  return ok({ data: await toRoleDto(db, role!) })
}
