import { ok, fail } from "@avuny/utils"
import {
  AUDIT_EVENT_TYPES,
  OrganizationErrorCode as Err,
  RESERVED_ORGANIZATION_CODES,
  type CreateOrganizationInput,
  type OrganizationAction,
  type OrganizationDto,
  type OrganizationListQuery,
  type UpdateOrganizationInput,
} from "@avuny/contracts"
import type { DB, Organization, Tx } from "@avuny/db"
import { db } from "../../db.js"
import {
  createOrganizationRepository,
  isUniqueViolation,
  type OrganizationRepository,
} from "./organization.repository.js"

export type {
  CreateOrganizationInput,
  UpdateOrganizationInput,
  OrganizationListQuery,
  OrganizationDto,
  OrganizationAction,
}

/* ---------- ports (replace with your existing types if you already have them) ---------- */

export interface PermissionChecker {
  check(
    subject: { userId: string },
    action: OrganizationAction,
    options?: { resourceId?: string }
  ): Promise<boolean>
}

export interface Cache {
  get<T>(key: string): Promise<T | null>
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>
  del(key: string): Promise<void>
}

export interface ActivityLog {
  /** Receives the transaction so the audit row commits (or rolls back) with the change. */
  record(
    entry: {
      type: string
      actorId: string
      orgId?: string
      resourceId?: string
      metadata?: Record<string, unknown>
    },
    tx?: Tx
  ): Promise<void>
}

export interface OrganizationLimits {
  /** Max organizations a user may own (usually derived from their plan). */
  maxOwnedPerUser(userId: string): Promise<number>
}

export type OrganizationServiceDeps = {
  repo: OrganizationRepository
  permissions: PermissionChecker
  cache: Cache
  activityLog: ActivityLog
  limits: OrganizationLimits
}

/* ---------- dummy implementations ---------- */

export class DummyPermissionChecker implements PermissionChecker {
  async check(
    _subject: { userId: string },
    _action: OrganizationAction,
    _options?: { resourceId?: string }
  ): Promise<boolean> {
    return true
  }
}

export class DummyCache implements Cache {
  async get<T>(_key: string): Promise<T | null> {
    return null
  }
  async set(_key: string, _value: unknown, _ttlSeconds: number): Promise<void> {}
  async del(_key: string): Promise<void> {}
}

export class DummyActivityLog implements ActivityLog {
  async record(
    _entry: {
      type: string
      actorId: string
      orgId?: string
      resourceId?: string
      metadata?: Record<string, unknown>
    },
    _tx?: Tx
  ): Promise<void> {}
}

export class DummyOrganizationLimits implements OrganizationLimits {
  async maxOwnedPerUser(_userId: string): Promise<number> {
    return 100
  }
}

/* ---------- helpers ---------- */

const toDto = (o: Organization): OrganizationDto => ({
  id: o.id,
  code: o.code,
  name: o.name,
  status: o.status,
  countryCode: o.countryCode,
  stateId: o.stateId,
  defaultCurrency: o.defaultCurrency,
  timezone: o.timezone,
})

/* ---------- constants ---------- */

const CACHE_TTL_SECONDS = 300
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

/** Subdomain labels that must never become an organization code. */
const RESERVED_CODES = new Set<string>(RESERVED_ORGANIZATION_CODES)

const cacheKey = (id: string) => `organization:${id}`
const clamp = (n: number, min: number, max: number) =>
  Math.min(Math.max(n, min), max)

/* ---------- service ---------- */

export const createOrganizationService = ({
  repo,
  permissions,
  cache,
  activityLog,
  limits,
}: OrganizationServiceDeps) => {
  const can = (
    userId: string,
    action: OrganizationAction,
    resourceId?: string
  ) => permissions.check({ userId }, action, { resourceId })

  const forbidden = () =>
    fail({
      error: Err.ORGANIZATION_FORBIDDEN,
      msg: "You are not allowed to perform this action",
    })
  const notFound = () =>
    fail({ error: Err.ORGANIZATION_NOT_FOUND, msg: "Organization not found" })
  const nameTaken = () =>
    fail({
      error: Err.ORGANIZATION_NAME_TAKEN,
      msg: "You already have an organization with this name",
    })

  return {
    async create(actorId: string, input: CreateOrganizationInput) {
      if (!(await can(actorId, "create:organization"))) return forbidden()

      const { ownerUsername, ...fields } = input
      const data = { ...fields, name: fields.name.trim() }

      if (RESERVED_CODES.has(data.code)) {
        return fail({
          error: Err.ORGANIZATION_CODE_RESERVED,
          msg: "This organization code is reserved",
        })
      }

      const max = await limits.maxOwnedPerUser(actorId)

      try {
        return await repo.transaction(async (tx) => {
          // Serialise concurrent creates by the same owner, so the limit and the
          // name check below cannot both pass for two parallel requests.
          await repo.lockOwner({ ownerId: actorId, tx })

          if ((await repo.countOwned({ ownerId: actorId, tx })) >= max) {
            return fail({
              error: Err.ORGANIZATION_LIMIT_REACHED,
              msg: `You can own at most ${max} organizations`,
            })
          }
          if (
            await repo.existsOwnedByName({ ownerId: actorId, name: data.name, tx })
          ) {
            return nameTaken()
          }

          const org = await repo.createWithOwner({
            data,
            ownerId: actorId,
            ownerUsername,
            tx,
          })
          await activityLog.record(
            {
              type: AUDIT_EVENT_TYPES.ORGANIZATION_CREATED,
              actorId,
              orgId: org.id,
              resourceId: org.id,
              metadata: { code: org.code, name: org.name },
            },
            tx
          )
          return ok({
            data: toDto(org),
            msg: "Organization created successfully",
          })
        })
      } catch (err) {
        // The unique index on `code` is the source of truth for code races.
        if (isUniqueViolation(err, "ux_org_code")) {
          return fail({
            error: Err.ORGANIZATION_CODE_TAKEN,
            msg: "This organization code is already taken",
          })
        }
        throw err
      }
    },

    async update(actorId: string, id: string, input: UpdateOrganizationInput) {
      if (!(await can(actorId, "update:organization", id))) return forbidden()

      const name = input.name?.trim()

      const result = await repo.transaction(async (tx) => {
        const current = await repo.findById({ id, tx })
        if (!current) return notFound()

        // Only a real rename needs the lock + uniqueness check (case-only changes are fine).
        if (name !== undefined && name.toLowerCase() !== current.name.toLowerCase()) {
          await repo.lockOwner({ ownerId: current.ownerId, tx })
          if (
            await repo.existsOwnedByName({
              ownerId: current.ownerId,
              name,
              excludeId: id,
              tx,
            })
          ) {
            return nameTaken()
          }
        }

        const updated = await repo.update({
          id,
          data: { ...input, ...(name !== undefined && { name }) },
          tx,
        })
        if (!updated) return notFound()

        await activityLog.record(
          {
            type: AUDIT_EVENT_TYPES.ORGANIZATION_UPDATED,
            actorId,
            orgId: id,
            resourceId: id,
            metadata: { fields: Object.keys(input) },
          },
          tx
        )
        return ok({
          data: toDto(updated),
          msg: "Organization updated successfully",
        })
      })

      await cache.del(cacheKey(id)) // after commit; harmless when the update failed
      return result
    },

    /** Soft delete (status 'closed'); rows are never hard-deleted. */
    async delete(actorId: string, id: string) {
      if (!(await can(actorId, "delete:organization", id))) return forbidden()

      const result = await repo.transaction(async (tx) => {
        const deleted = await repo.softDelete({ id, tx })
        if (!deleted) return notFound()

        await activityLog.record(
          {
            type: AUDIT_EVENT_TYPES.ORGANIZATION_DELETED,
            actorId,
            orgId: id,
            resourceId: id,
          },
          tx
        )
        return ok({ data: { id }, msg: "Organization deleted successfully" })
      })

      await cache.del(cacheKey(id))
      return result
    },

    /** Read-through cache. Permission is checked first, so a cache hit never bypasses it. */
    async getById(actorId: string, id: string) {
      if (!(await can(actorId, "read:organization", id))) return forbidden()

      const cached = await cache.get<OrganizationDto>(cacheKey(id))
      if (cached) {
        return ok({ data: cached, msg: "Organization retrieved successfully" })
      }

      const org = await repo.findById({ id })
      if (!org) return notFound()

      const dto = toDto(org)
      await cache.set(cacheKey(id), dto, CACHE_TTL_SECONDS)
      return ok({ data: dto, msg: "Organization retrieved successfully" })
    },

    /*
     * The three methods below only ever see organizations the caller is an active member
     * of (enforced in the repository query), so membership is the authorization:
     * no extra permission check.
     */

    /** Tables / admin lists: page + pageSize with a total. */
    async getOffsetPaginationList(
      userId: string,
      query: OrganizationListQuery & { page?: number; pageSize?: number } = {}
    ) {
      const pageSize = clamp(query.pageSize ?? DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE)
      const page = Math.max(query.page ?? 1, 1)

      const { items, total } = await repo.listPage({
        filter: { userId, search: query.search, status: query.status },
        limit: pageSize,
        offset: (page - 1) * pageSize,
      })

      return ok({
        data: {
          items: items.map(toDto),
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
        msg: "Organizations retrieved successfully",
      })
    },

    /** Selects / dropdowns: `{ id, label }` items and a `nextCursor` (null on the last page). */
    async getCursorPaginationList(
      userId: string,
      query: OrganizationListQuery & { cursor?: string; limit?: number } = {}
    ) {
      const limit = clamp(query.limit ?? DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE)

      // Fetch one extra row to know whether another page exists.
      const rows = await repo.listOptions({
        filter: { userId, search: query.search, status: query.status },
        limit: limit + 1,
        cursor: query.cursor,
      })
      const hasMore = rows.length > limit
      const page = hasMore ? rows.slice(0, limit) : rows

      return ok({
        data: {
          items: page.map((r) => ({ id: r.id, label: r.name })),
          nextCursor: hasMore ? page[page.length - 1]!.id : null,
        },
        msg: "Organizations retrieved successfully",
      })
    },

    async count(userId: string, query: OrganizationListQuery = {}) {
      const count = await repo.count({
        filter: { userId, search: query.search, status: query.status },
      })
      return ok({ data: { count }, msg: "Organizations counted successfully" })
    },
  }
}

/** Use this to type the service where it is injected (routes, container). */
export type OrganizationService = ReturnType<typeof createOrganizationService>

export const createDefaultOrganizationService = (dbInstance: DB = db) => {
  const repo = createOrganizationRepository({ db: dbInstance })
  return createOrganizationService({
    repo,
    permissions: new DummyPermissionChecker(),
    cache: new DummyCache(),
    activityLog: new DummyActivityLog(),
    limits: new DummyOrganizationLimits(),
  })
}

export const organizationService = createDefaultOrganizationService()
