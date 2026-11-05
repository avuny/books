import {
  canAccess,
  parsePermissionKey,
  type EffectivePermissions,
  type PermissionStatement,
} from "@avuny/contracts"
import type {
  Cache,
  PermissionChecker,
  PermissionResolver,
  PermissionResolverDeps,
} from "./role.types.js"
import { DummyCache } from "./testing.js"

export { DummyCache }
export type { Cache, PermissionChecker, PermissionResolver, PermissionResolverDeps }

/* ---------- resolver: "what may this user do in this org?" ---------- */

const STATEMENTS_TTL_SECONDS = 60
const statementsKey = (orgUserId: string) => `rbac:statements:${orgUserId}`

/**
 * Membership is ALWAYS read fresh (one indexed query), so deactivating a member or an
 * ownership change takes effect immediately. Only the role statements are cached, and the
 * role module invalidates them when roles or assignments change; the TTL bounds anything
 * else (e.g. system roles re-seeded).
 */
export function createPermissionResolver(deps: PermissionResolverDeps) {
  const repo = deps.repository
  const cache = deps.cache ?? new DummyCache()
  const ttl = deps.ttlSeconds ?? STATEMENTS_TTL_SECONDS

  return {
    async resolve(orgId: string, userId: string): Promise<EffectivePermissions> {
      const member = await repo.findMembership(orgId, userId)
      if (!member || !member.isActive) return { kind: "none" }
      if (member.type === "owner") return { kind: "owner" }
      if (member.type !== "managed") return { kind: "none" } // portal users hold no roles

      const key = statementsKey(member.id)
      let statements = await cache.get<PermissionStatement[]>(key)
      if (!statements) {
        statements = await repo.listStatementsForMember(member.id)
        await cache.set(key, statements, ttl)
      }
      return { kind: "member", orgUserId: member.id, statements }
    },

    /** Call after a member's role assignments change. */
    invalidateMember(orgUserId: string): Promise<void> {
      return cache.del(statementsKey(orgUserId))
    },

    /** Call after a role's statements change: drops the cache of everyone holding it. */
    async invalidateRole(roleId: string): Promise<void> {
      const ids = await repo.listAssignedOrgUserIds(roleId)
      await Promise.all(ids.map((id) => cache.del(statementsKey(id))))
    },
  }
}

/* ---------- checker: the PermissionChecker the rest of the server injects ---------- */

export function createRbacPermissionChecker({
  resolver,
}: {
  resolver: PermissionResolver
}): PermissionChecker {
  return {
    async check(subject, key, ctx) {
      const { action, resource } = parsePermissionKey(key)
      const orgId = ctx?.orgId ?? (resource === "organization" ? ctx?.resourceId : undefined)
      if (!orgId) return false
      const effective = await resolver.resolve(orgId, subject.userId)
      return canAccess(effective, {
        action,
        resource,
        resourceId: ctx?.orgId ? ctx.resourceId : undefined,
      })
    },
  }
}
