import { randomBytes } from "node:crypto"
import { and, asc, count, eq, gt, isNull, or, sql } from "@avuny/db"
import {
  platformAdminRoles,
  platformAdminSessions,
  platformAdmins,
  platformInvites,
  platformRolePermissions,
  platformRoles,
  type DB,
  type PlatformAdmin,
} from "@avuny/db"
import {
  PLATFORM_AUDIT_ACTIONS,
  PLATFORM_INVITE_TTL_HOURS,
  PLATFORM_TOKEN_BYTES,
  PlatformManagementErrorCode as Code,
  type PlatformAdminDto,
  type PlatformAdminListResponse,
} from "@avuny/contracts/platform-admin"
import { fail, ok, type Result } from "@avuny/utils"
import { config } from "../../config.js"
import {
  hashPlatformToken,
  normalizePlatformEmail,
} from "./platform-admin.bootstrap.js"
import {
  isSuperAdmin,
  loadEffectivePermissions,
} from "../platform-auth/platform-auth.middleware.js"
import { writePlatformAudit } from "../platform-auth/platform-auth.audit.js"
import {
  loadRoleKeys,
  toPlatformAdminDto,
  type RequestContext,
} from "../platform-auth/platform-auth.service.js"

/**
 * Admin management (A1-05): list, invite, update, role assignment, disable.
 * Rules PA-R2..PA-R4 are enforced here and PA-R3 (last super admin) additionally
 * by guarded single statements, so the rules hold without multi-statement
 * transactions and under concurrent requests (PAC3).
 */

export type ManagementResult<T, E extends string> = Result<T, E>

/** Role keys with names, for audit before/after snapshots (never secrets, PA-R11). */
async function roleKeysOfIds(db: DB, roleIds: string[]): Promise<string[]> {
  if (roleIds.length === 0) return []
  const rows = await db
    .select({ id: platformRoles.id, key: platformRoles.key })
    .from(platformRoles)
  const byId = new Map(rows.map((row) => [row.id, row.key]))
  return roleIds.map((id) => byId.get(id) ?? id)
}

/**
 * PA-R2 anti-escalation: the permissions being granted must be a subset of the
 * caller's own effective permissions, and only a super_admin can grant the
 * super_admin role.
 */
async function assertCanGrant(
  db: DB,
  callerId: string,
  roleIds: string[]
): Promise<ManagementResult<null, typeof Code.ESCALATION_DENIED>> {
  if (roleIds.length === 0) return ok({ data: null })

  // Roles and their grants are few (five built-ins plus customs): load, no joins.
  const roles = await db
    .select({ id: platformRoles.id, key: platformRoles.key })
    .from(platformRoles)
  const keyById = new Map(roles.map((row) => [row.id, row.key]))

  const grantedPermissions = new Set<string>()
  let grantsSuperAdmin = false
  for (const roleId of roleIds) {
    if (keyById.get(roleId) === "super_admin") grantsSuperAdmin = true
    const grants = await db
      .select({ permissionKey: platformRolePermissions.permissionKey })
      .from(platformRolePermissions)
      .where(eq(platformRolePermissions.roleId, roleId))
    for (const grant of grants) grantedPermissions.add(grant.permissionKey)
  }

  const callerPermissions = await loadEffectivePermissions(db, callerId)
  for (const permission of grantedPermissions) {
    if (!callerPermissions.has(permission)) {
      return fail({
        error: Code.ESCALATION_DENIED,
        msg: `Cannot grant ${permission}`,
      })
    }
  }
  if (grantsSuperAdmin && !(await isSuperAdmin(db, callerId))) {
    return fail({
      error: Code.ESCALATION_DENIED,
      msg: "Only super_admin can grant super_admin",
    })
  }
  return ok({ data: null })
}

/* -------------------------------------------------------------------- list */

export async function listAdmins(
  db: DB,
  query: { cursor?: string; limit: number; status?: PlatformAdmin["status"] }
): Promise<PlatformAdminListResponse> {
  const conditions = []
  if (query.status) conditions.push(eq(platformAdmins.status, query.status))
  if (query.cursor) {
    // Stable keyset pagination over (created_at, id) (PA-R13).
    conditions.push(
      sql`(${platformAdmins.createdAt}, ${platformAdmins.id}) > (select created_at, id from platform_admins where id = ${query.cursor})`
    )
  }
  const rows = await db
    .select()
    .from(platformAdmins)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(platformAdmins.createdAt), asc(platformAdmins.id))
    .limit(query.limit + 1)

  const page = rows.slice(0, query.limit)
  const nextCursor = rows.length > query.limit ? page[page.length - 1]!.id : null
  const admins: PlatformAdminDto[] = []
  for (const admin of page) {
    admins.push(toPlatformAdminDto(admin, await loadRoleKeys(db, admin.id)))
  }
  return { admins, nextCursor }
}

export async function getAdmin(
  db: DB,
  adminId: string
): Promise<ManagementResult<PlatformAdminDto, typeof Code.ADMIN_NOT_FOUND>> {
  const [admin] = await db
    .select()
    .from(platformAdmins)
    .where(eq(platformAdmins.id, adminId))
    .limit(1)
  if (!admin) return fail({ error: Code.ADMIN_NOT_FOUND, msg: "No such admin" })
  return ok({ data: toPlatformAdminDto(admin, await loadRoleKeys(db, admin.id)) })
}

/* ------------------------------------------------------------------- invite */

export interface InviteAdminResult {
  inviteId: string
  inviteUrl: string
  expiresAt: string
}

export async function inviteAdmin(
  db: DB,
  caller: PlatformAdmin,
  input: { email: string; roleIds: string[] },
  ctx: RequestContext
): Promise<
  ManagementResult<
    InviteAdminResult,
    | typeof Code.INVALID_ROLE_IDS
    | typeof Code.ESCALATION_DENIED
    | typeof Code.ADMIN_EXISTS
    | typeof Code.INVITE_PENDING
  >
> {
  const email = normalizePlatformEmail(input.email)

  const foundRoles = await db
    .select({ id: platformRoles.id })
    .from(platformRoles)
  const knownIds = new Set(foundRoles.map((row) => row.id))
  if (!input.roleIds.every((id) => knownIds.has(id))) {
    return fail({ error: Code.INVALID_ROLE_IDS, msg: "Unknown role id" })
  }

  const canGrant = await assertCanGrant(db, caller.id, input.roleIds)
  if (!canGrant.success) return canGrant

  const [existingAdmin] = await db
    .select({ id: platformAdmins.id })
    .from(platformAdmins)
    .where(eq(platformAdmins.email, email))
    .limit(1)
  if (existingAdmin) {
    return fail({ error: Code.ADMIN_EXISTS, msg: "Admin already exists" })
  }
  const [pendingInvite] = await db
    .select({ id: platformInvites.id })
    .from(platformInvites)
    .where(
      and(
        eq(platformInvites.email, email),
        isNull(platformInvites.acceptedAt),
        isNull(platformInvites.revokedAt),
        gt(platformInvites.expiresAt, new Date())
      )
    )
    .limit(1)
  if (pendingInvite) {
    return fail({ error: Code.INVITE_PENDING, msg: "Invite already pending" })
  }

  const token = randomBytes(PLATFORM_TOKEN_BYTES).toString("hex")
  const expiresAt = new Date(Date.now() + PLATFORM_INVITE_TTL_HOURS * 3_600_000)
  const [invite] = await db
    .insert(platformInvites)
    .values({
      email,
      roleIds: input.roleIds,
      tokenHash: hashPlatformToken(token),
      expiresAt,
      invitedBy: caller.id,
    })
    .returning({ id: platformInvites.id })

  await writePlatformAudit(db, {
    adminId: caller.id,
    action: PLATFORM_AUDIT_ACTIONS.ADMIN_INVITED,
    resource: "platform-invite",
    resourceId: invite!.id,
    after: { email, roles: await roleKeysOfIds(db, input.roleIds) },
    ipAddress: ctx.ipAddress,
  })

  const base = config.WEB_APP_URL.replace(/\/+$/, "")
  return ok({
    data: {
      inviteId: invite!.id,
      inviteUrl: `${base}/accept-invite?token=${token}`,
      expiresAt: expiresAt.toISOString(),
    },
  })
}

/* ------------------------------------------------------------------- update */

export async function updateAdmin(
  db: DB,
  caller: PlatformAdmin,
  adminId: string,
  input: { name: string },
  ctx: RequestContext
): Promise<ManagementResult<PlatformAdminDto, typeof Code.ADMIN_NOT_FOUND>> {
  const [admin] = await db
    .select()
    .from(platformAdmins)
    .where(eq(platformAdmins.id, adminId))
    .limit(1)
  if (!admin) return fail({ error: Code.ADMIN_NOT_FOUND, msg: "No such admin" })

  const [updated] = await db
    .update(platformAdmins)
    .set({ name: input.name.trim(), updatedAt: new Date() })
    .where(eq(platformAdmins.id, adminId))
    .returning()
  await writePlatformAudit(db, {
    adminId: caller.id,
    action: PLATFORM_AUDIT_ACTIONS.ADMIN_UPDATED,
    resource: "platform-admin",
    resourceId: adminId,
    before: { name: admin.name },
    after: { name: updated!.name },
    ipAddress: ctx.ipAddress,
  })
  return ok({
    data: toPlatformAdminDto(updated!, await loadRoleKeys(db, adminId)),
  })
}

/* ------------------------------------------------------------- role assignment */

export async function setAdminRoles(
  db: DB,
  caller: PlatformAdmin,
  adminId: string,
  roleIds: string[],
  ctx: RequestContext
): Promise<
  ManagementResult<
    PlatformAdminDto,
    | typeof Code.ADMIN_NOT_FOUND
    | typeof Code.INVALID_ROLE_IDS
    | typeof Code.SELF_EDIT_DENIED
    | typeof Code.ESCALATION_DENIED
    | typeof Code.LAST_SUPER_ADMIN
  >
> {
  const [target] = await db
    .select()
    .from(platformAdmins)
    .where(eq(platformAdmins.id, adminId))
    .limit(1)
  if (!target) return fail({ error: Code.ADMIN_NOT_FOUND, msg: "No such admin" })
  if (target.id === caller.id) {
    // PA-R4: never your own roles.
    return fail({ error: Code.SELF_EDIT_DENIED, msg: "Cannot change own roles" })
  }

  const foundRoles = await db.select({ id: platformRoles.id }).from(platformRoles)
  const knownIds = new Set(foundRoles.map((row) => row.id))
  if (!roleIds.every((id) => knownIds.has(id))) {
    return fail({ error: Code.INVALID_ROLE_IDS, msg: "Unknown role id" })
  }
  const canGrant = await assertCanGrant(db, caller.id, roleIds)
  if (!canGrant.success) return canGrant

  const currentRows = await db
    .select({ roleId: platformAdminRoles.roleId })
    .from(platformAdminRoles)
    .where(eq(platformAdminRoles.adminId, adminId))
  const current = new Set(currentRows.map((row) => row.roleId))
  const next = new Set(roleIds)
  const toAdd = [...next].filter((id) => !current.has(id))
  const toRemove = [...current].filter((id) => !next.has(id))

  // PA-R3, race-safe (PAC3): removing the super_admin role only applies while
  // another ACTIVE super_admin exists. The CTE locks every active super's
  // membership+admin rows in id order, so concurrent removals/disables
  // serialize on the row locks and re-evaluate under EvalPlanQual instead of
  // acting on a stale snapshot (no multi-statement transactions on Neon HTTP).
  const [superRole] = await db
    .select({ id: platformRoles.id })
    .from(platformRoles)
    .where(eq(platformRoles.key, "super_admin"))
    .limit(1)
  if (superRole && current.has(superRole.id) && !next.has(superRole.id)) {
    const removed = await db.execute<{ role_id: string }>(sql`
      with locked as (
        select ar.admin_id
        from platform_admin_roles ar
        join platform_admins a on a.id = ar.admin_id
        where ar.role_id = ${superRole.id} and a.status = 'active'
        order by ar.admin_id
        for update of ar, a
      )
      delete from platform_admin_roles
      where admin_id = ${adminId} and role_id = ${superRole.id}
        and exists (
          select 1 from locked where admin_id <> ${adminId}
        )
      returning role_id
    `)
    if (removed.rows.length === 0) {
      return fail({
        error: Code.LAST_SUPER_ADMIN,
        msg: "The last active super_admin cannot lose the role",
      })
    }
    toRemove.splice(toRemove.indexOf(superRole.id), 1)
  }

  if (toRemove.length > 0) {
    await db
      .delete(platformAdminRoles)
      .where(
        and(
          eq(platformAdminRoles.adminId, adminId),
          or(...toRemove.map((id) => eq(platformAdminRoles.roleId, id)))
        )
      )
  }
  if (toAdd.length > 0) {
    await db.insert(platformAdminRoles).values(
      toAdd.map((roleId) => ({ adminId, roleId, grantedBy: caller.id }))
    )
  }

  await writePlatformAudit(db, {
    adminId: caller.id,
    action: PLATFORM_AUDIT_ACTIONS.ADMIN_UPDATED,
    resource: "platform-admin",
    resourceId: adminId,
    before: { roles: await roleKeysOfIds(db, [...current]) },
    after: { roles: await roleKeysOfIds(db, [...next]) },
    ipAddress: ctx.ipAddress,
  })
  return ok({
    data: toPlatformAdminDto(target, await loadRoleKeys(db, adminId)),
  })
}

/* ------------------------------------------------------------------ disable */

export async function disableAdmin(
  db: DB,
  caller: PlatformAdmin,
  adminId: string,
  ctx: RequestContext
): Promise<
  ManagementResult<
    PlatformAdminDto,
    | typeof Code.ADMIN_NOT_FOUND
    | typeof Code.SELF_EDIT_DENIED
    | typeof Code.LAST_SUPER_ADMIN
  >
> {
  const [target] = await db
    .select()
    .from(platformAdmins)
    .where(eq(platformAdmins.id, adminId))
    .limit(1)
  if (!target) return fail({ error: Code.ADMIN_NOT_FOUND, msg: "No such admin" })
  if (target.id === caller.id) {
    // PA-R4: never disable yourself.
    return fail({ error: Code.SELF_EDIT_DENIED, msg: "Cannot disable yourself" })
  }
  if (target.status === "disabled") {
    return ok({ data: toPlatformAdminDto(target, await loadRoleKeys(db, adminId)) })
  }

  // PA-R3, race-safe (PAC3): disabling an active super_admin only applies while
  // another ACTIVE super_admin exists, checked in the same guarded statement.
  const [superRole] = await db
    .select({ id: platformRoles.id })
    .from(platformRoles)
    .where(eq(platformRoles.key, "super_admin"))
    .limit(1)
  const targetIsSuper =
    superRole !== undefined &&
    (await db
      .select({ roleId: platformAdminRoles.roleId })
      .from(platformAdminRoles)
      .where(
        and(
          eq(platformAdminRoles.adminId, adminId),
          eq(platformAdminRoles.roleId, superRole.id)
        )
      )
      .limit(1)
      .then((rows) => rows.length > 0))

  const updated = targetIsSuper
    ? (
        await db.execute<{ id: string }>(sql`
          with locked as (
            select ar.admin_id
            from platform_admin_roles ar
            join platform_admins a on a.id = ar.admin_id
            where ar.role_id = ${superRole!.id} and a.status = 'active'
            order by ar.admin_id
            for update of ar, a
          )
          update platform_admins
          set status = 'disabled', updated_at = now()
          where id = ${adminId}
            and status <> 'disabled'
            and exists (
              select 1 from locked where admin_id <> ${adminId}
            )
          returning id
        `)
      ).rows
    : await db
        .update(platformAdmins)
        .set({ status: "disabled", updatedAt: new Date() })
        .where(
          and(eq(platformAdmins.id, adminId), sql`${platformAdmins.status} <> 'disabled'`)
        )
        .returning({ id: platformAdmins.id })
  if (updated.length === 0) {
    return fail({
      error: Code.LAST_SUPER_ADMIN,
      msg: "The last active super_admin cannot be disabled",
    })
  }

  // A disabled admin loses every live session immediately.
  await db
    .update(platformAdminSessions)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(platformAdminSessions.adminId, adminId),
        isNull(platformAdminSessions.revokedAt)
      )
    )

  await writePlatformAudit(db, {
    adminId: caller.id,
    action: PLATFORM_AUDIT_ACTIONS.ADMIN_DISABLED,
    resource: "platform-admin",
    resourceId: adminId,
    before: { status: target.status },
    after: { status: "disabled" },
    ipAddress: ctx.ipAddress,
  })
  return ok({
    data: toPlatformAdminDto(
      { ...target, status: "disabled" },
      await loadRoleKeys(db, adminId)
    ),
  })
}

/** Live session count for the detail view. */
export async function countActiveSessions(db: DB, adminId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(platformAdminSessions)
    .where(
      and(
        eq(platformAdminSessions.adminId, adminId),
        isNull(platformAdminSessions.revokedAt),
        gt(platformAdminSessions.expiresAt, new Date())
      )
    )
  return row?.value ?? 0
}
