import {
  findInvalidStatement,
  grantsAll,
  PERMISSION_CATALOG,
  ROLE_AUDIT_EVENTS,
  type MemberRolesDto,
  type MyPermissionsDto,
  type PermissionCatalogResponse,
  type PermissionStatement,
  type RoleDto,
  type RoleOffsetListQuery,
  type RoleOffsetListResponse,
  type SetMemberRolesInput,
  type CreateRoleInput,
  type UpdateRoleInput,
} from "@avuny/contracts"
import { fail, ok, type Result } from "@avuny/utils"
import { RoleErrorCode, type RoleErrorCode as Code } from "./role.errors.js"
import { toMemberRolesDto, toRoleDto, toRoleListItemDto } from "./role.mapper.js"
import { permissionResolver, type PermissionResolver } from "./role.permissions.js"
import { createRoleRepository, type RoleRepository } from "./role.repository.js"
import { db } from "../../db.js"

const Err = RoleErrorCode

/* ---------- ports ---------- */

/** Plan features. `customRoles` gates creating and editing custom roles. */
export interface PlanFeatures {
  has(orgId: string, feature: "customRoles"): Promise<boolean>
}
export class DummyPlanFeatures implements PlanFeatures {
  async has(): Promise<boolean> {
    return true
  }
}

export interface ActivityLogEntry {
  type: string
  actorId: string
  orgId: string
  entityId: string
  metadata?: Record<string, unknown>
}
export interface ActivityLog {
  log(entry: ActivityLogEntry): Promise<void>
}
export class DummyActivityLog implements ActivityLog {
  async log(): Promise<void> { }
}

/* ---------- internals ---------- */

type Failure = { failed: true; error: Code; msg: string }
const failure = (error: Code, msg: string): Failure => ({ failed: true, error, msg })
const isFailure = (v: unknown): v is Failure =>
  typeof v === "object" && v !== null && (v as Failure).failed === true
const toFail = (f: Failure) => fail({ error: f.error, msg: f.msg })

const MSG = {
  notFound: "Role not found",
  systemReadonly: "System roles cannot be changed or deleted",
  nameTaken: "A role with this name already exists",
  memberNotFound: "Member not found",
} as const

const keyOf = (s: PermissionStatement) =>
  `${s.effect}|${s.resource}|${s.action}|${s.resourceId}`
const dedupe = (list: readonly PermissionStatement[]): PermissionStatement[] => [
  ...new Map(list.map((s) => [keyOf(s), s])).values(),
]

function invalidPermission(list: readonly PermissionStatement[]) {
  const bad = findInvalidStatement(list)
  if (!bad) return null
  const s = list[bad.index]!
  return fail({
    error: Err.ROLE_INVALID_PERMISSION,
    msg: `Invalid permission "${s.action}:${s.resource}" (${bad.reason})`,
  })
}

export interface RoleServiceDeps {
  repository: RoleRepository
  resolver: PermissionResolver
  features?: PlanFeatures
  activityLog?: ActivityLog
  now?: () => Date
}

/**
 * Authorization is enforced at the route with requirePermission(...); this service holds
 * the business rules (system roles are read-only, in-use roles cannot be deleted, no
 * privilege escalation when assigning roles).
 */
export function createRoleService(deps: RoleServiceDeps) {
  const repo = deps.repository
  const resolver = deps.resolver
  const features = deps.features ?? new DummyPlanFeatures()
  const activityLog = deps.activityLog ?? new DummyActivityLog()

  return {
    /** What the "create role" screen offers. */
    getCatalog(): Result<PermissionCatalogResponse, Code> {
      return ok({
        data: {
          resources: PERMISSION_CATALOG.map((e) => ({
            resource: e.resource,
            actions: [...e.actions],
            scopable: "scopable" in e ? Boolean(e.scopable) : false,
          })),
        },
        msg: "Permission catalog retrieved successfully",
      })
    },

    async list(
      orgId: string,
      query: RoleOffsetListQuery
    ): Promise<Result<RoleOffsetListResponse, Code>> {
      const { rows, total } = await repo.list(orgId, query)
      return ok({
        data: {
          items: rows.map((r) => toRoleListItemDto(r.role, r)),
          page: query.page,
          pageSize: query.pageSize,
          total,
        },
        msg: "Roles retrieved successfully",
      })
    },

    async getById(orgId: string, roleId: string) {
      const role = await repo.findVisibleById(orgId, roleId)
      if (!role) return fail({ error: Err.ROLE_NOT_FOUND, msg: MSG.notFound })
      const [statements, memberCount] = await Promise.all([
        repo.listStatements(role.id),
        repo.countOrgAssignments(orgId, role.id),
      ])
      return ok({ data: toRoleDto(role, statements, memberCount), msg: "Role retrieved" })
    },

    async create(
      actorId: string,
      orgId: string,
      input: CreateRoleInput
    ): Promise<Result<RoleDto, Code>> {
      if (!(await features.has(orgId, "customRoles")))
        return fail({
          error: Err.ROLE_FEATURE_NOT_AVAILABLE,
          msg: "Custom roles are not available on your plan",
        })
      const statements = dedupe(input.permissions)
      const invalid = invalidPermission(statements)
      if (invalid) return invalid

      const outcome = await repo.transaction(async (tx) => {
        await repo.lockOrgRoles(orgId, tx)
        if (await repo.nameTaken(orgId, input.name, undefined, tx))
          return failure(Err.ROLE_NAME_TAKEN, MSG.nameTaken)
        const res = await repo.insertRole(
          { orgId, name: input.name, description: input.description ?? null },
          tx
        )
        if (!res.ok) return failure(Err.ROLE_NAME_TAKEN, MSG.nameTaken)
        await repo.replaceStatements(res.row.id, statements, tx)
        return res.row
      })
      if (isFailure(outcome)) return toFail(outcome)

      await activityLog.log({
        type: ROLE_AUDIT_EVENTS.CREATED,
        actorId,
        orgId,
        entityId: outcome.id,
        metadata: { name: outcome.name, statements: statements.length },
      })
      return ok({ data: toRoleDto(outcome, statements, 0), msg: "Role created" })
    },

    async update(
      actorId: string,
      orgId: string,
      roleId: string,
      input: UpdateRoleInput
    ): Promise<Result<RoleDto, Code>> {
      if (!(await features.has(orgId, "customRoles")))
        return fail({
          error: Err.ROLE_FEATURE_NOT_AVAILABLE,
          msg: "Custom roles are not available on your plan",
        })
      const statements = input.permissions ? dedupe(input.permissions) : undefined
      if (statements) {
        const invalid = invalidPermission(statements)
        if (invalid) return invalid
      }

      const outcome = await repo.transaction(async (tx) => {
        await repo.lockOrgRoles(orgId, tx)
        const role = await repo.findVisibleById(orgId, roleId, tx)
        if (!role) return failure(Err.ROLE_NOT_FOUND, MSG.notFound)
        if (role.orgId === null) return failure(Err.ROLE_SYSTEM_READONLY, MSG.systemReadonly)

        if (
          input.name !== undefined &&
          input.name !== role.name &&
          (await repo.nameTaken(orgId, input.name, roleId, tx))
        )
          return failure(Err.ROLE_NAME_TAKEN, MSG.nameTaken)

        const res = await repo.updateRole(
          roleId,
          {
            ...(input.name !== undefined && { name: input.name }),
            ...(input.description !== undefined && { description: input.description }),
          },
          tx
        )
        if (!res.ok)
          return failure(
            res.reason === "name_taken" ? Err.ROLE_NAME_TAKEN : Err.ROLE_NOT_FOUND,
            res.reason === "name_taken" ? MSG.nameTaken : MSG.notFound
          )
        if (statements) await repo.replaceStatements(roleId, statements, tx)
        const finalStatements = statements ?? (await repo.listStatements(roleId, tx))
        const memberCount = await repo.countOrgAssignments(orgId, roleId, tx)
        return { role: res.row, statements: finalStatements, memberCount }
      })
      if (isFailure(outcome)) return toFail(outcome)

      if (statements) await resolver.invalidateRole(roleId) // holders pick up the change now
      await activityLog.log({
        type: ROLE_AUDIT_EVENTS.UPDATED,
        actorId,
        orgId,
        entityId: roleId,
        metadata: { name: input.name, permissionsReplaced: !!statements },
      })
      return ok({
        data: toRoleDto(outcome.role, outcome.statements, outcome.memberCount),
        msg: "Role updated",
      })
    },

    async remove(
      actorId: string,
      orgId: string,
      roleId: string
    ): Promise<Result<{ id: string }, Code>> {
      const outcome = await repo.transaction(async (tx) => {
        await repo.lockOrgRoles(orgId, tx)
        const role = await repo.findVisibleById(orgId, roleId, tx)
        if (!role) return failure(Err.ROLE_NOT_FOUND, MSG.notFound)
        if (role.orgId === null) return failure(Err.ROLE_SYSTEM_READONLY, MSG.systemReadonly)
        if ((await repo.countAssignments(roleId, tx)) > 0)
          return failure(Err.ROLE_IN_USE, "This role is still assigned to members")
        const res = await repo.deleteRole(orgId, roleId, tx)
        if (!res.ok)
          return res.reason === "in_use"
            ? failure(Err.ROLE_IN_USE, "This role is still assigned to members")
            : failure(Err.ROLE_NOT_FOUND, MSG.notFound)
        return { name: role.name }
      })
      if (isFailure(outcome)) return toFail(outcome)

      await activityLog.log({
        type: ROLE_AUDIT_EVENTS.DELETED,
        actorId,
        orgId,
        entityId: roleId,
        metadata: { name: outcome.name },
      })
      return ok({ data: { id: roleId }, msg: "Role deleted" })
    },

    async getMemberRoles(
      orgId: string,
      memberId: string
    ): Promise<Result<MemberRolesDto, Code>> {
      const member = await repo.findMember(orgId, memberId)
      if (!member) return fail({ error: Err.ROLE_MEMBER_NOT_FOUND, msg: MSG.memberNotFound })
      return ok({
        data: toMemberRolesDto(member.id, await repo.listMemberRoles(member.id)),
        msg: "Member roles retrieved",
      })
    },

    /**
     * Replaces the member's roles with exactly `roleIds`.
     * Escalation guard: unless the actor is the owner, they cannot change their OWN roles
     * and can only ADD roles whose allow-statements they already hold themselves.
     */
    async setMemberRoles(
      actorId: string,
      orgId: string,
      memberId: string,
      input: SetMemberRolesInput
    ): Promise<Result<MemberRolesDto, Code>> {
      const roleIds = [...new Set(input.roleIds)]
      const actor = await resolver.resolve(orgId, actorId)

      const outcome = await repo.transaction(async (tx) => {
        await repo.lockOrgRoles(orgId, tx)
        const member = await repo.findMember(orgId, memberId, tx)
        if (!member) return failure(Err.ROLE_MEMBER_NOT_FOUND, MSG.memberNotFound)
        if (member.type !== "managed" || !member.isActive)
          return failure(
            Err.ROLE_MEMBER_NOT_ASSIGNABLE,
            "Roles can only be assigned to active managed members"
          )

        const found = await repo.findVisibleByIds(orgId, roleIds, tx)
        if (found.length !== roleIds.length)
          return failure(Err.ROLE_NOT_FOUND, MSG.notFound)

        const currentRoles = await repo.listMemberRoles(member.id, tx)
        const have = new Set(currentRoles.map((r) => r.id))
        const add = roleIds.filter((id) => !have.has(id))
        const remove = [...have].filter((id) => !roleIds.includes(id))
        if (!add.length && !remove.length) return { member, roles: currentRoles, add, remove }

        if (actor.kind !== "owner") {
          const selfChange = member.userId === actorId
          const statementsByRole = await repo.listStatementsForRoles(add, tx)
          const escalates = add.some(
            (id) => !grantsAll(actor, statementsByRole.get(id) ?? [])
          )
          if (selfChange || escalates)
            return failure(
              Err.ROLE_ESCALATION_NOT_ALLOWED,
              "You can only assign roles whose permissions you already have"
            )
        }

        await repo.applyMemberRoles(
          { orgId, orgUserId: member.id, add, remove, assignedByUserId: actorId },
          tx
        )
        return { member, roles: found, add, remove }
      })
      if (isFailure(outcome)) return toFail(outcome)

      if (outcome.add.length || outcome.remove.length) {
        await resolver.invalidateMember(outcome.member.id)
        await activityLog.log({
          type: ROLE_AUDIT_EVENTS.MEMBER_ROLES_CHANGED,
          actorId,
          orgId,
          entityId: outcome.member.id,
          metadata: { added: outcome.add, removed: outcome.remove },
        })
      }
      return ok({
        data: toMemberRolesDto(outcome.member.id, outcome.roles),
        msg: "Member roles updated",
      })
    },

    /** For the web app: sidebar items, buttons (see hasPermission in @avuny/contracts). */
    async myPermissions(
      userId: string,
      orgId: string
    ): Promise<Result<MyPermissionsDto, Code>> {
      const eff = await resolver.resolve(orgId, userId)
      if (eff.kind === "none")
        return fail({
          error: Err.ROLE_PERMISSION_DENIED,
          msg: "You do not have permission to perform this action",
        })
      return ok({
        data: {
          isOwner: eff.kind === "owner",
          statements: eff.kind === "member" ? eff.statements : [],
        },
        msg: "Permissions retrieved successfully",
      })
    },
  }
}

export type RoleService = ReturnType<typeof createRoleService>

export function createDefaultRoleService(): RoleService {
  return createRoleService({
    repository: createRoleRepository({ db }),
    resolver: permissionResolver, // shared instance: one cache for checker and service
  })
}

export const roleService = createDefaultRoleService()
