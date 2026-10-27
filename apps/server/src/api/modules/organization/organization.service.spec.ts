import { beforeEach, describe, expect, it, vi } from "vitest"
import { AUDIT_EVENT_TYPES, OrganizationErrorCode as Err } from "@avuny/contracts"
import type { Tx } from "@avuny/db"
import type { OrganizationRepository } from "./organization.repository.js"
import { createOrganizationService } from "./organization.service.js"

/*
 * Assertions use `toMatchObject` on `{ data }` / `{ error }` so they do not depend on
 * how `ok` / `fail` wrap the result. Tighten them if your Result has a discriminator.
 */

const ACTOR = "user-1"
const ORG_ID = "org-1"
const tx = { __tx: true } as unknown as Tx

const org = {
  id: ORG_ID,
  code: "acme",
  name: "Acme",
  status: "active" as const,
  countryCode: "EG",
  stateId: null,
  defaultCurrency: "EGP",
  timezone: "Africa/Cairo",
}

const createInput = {
  code: "acme",
  name: "  Acme  ",
  countryCode: "EG",
  stateId: null,
  defaultCurrency: "EGP",
  timezone: "Africa/Cairo",
  ownerUsername: "owner",
}

const makeService = () => {
  // `satisfies` forces this mock to cover every repository method.
  const repo = {
    transaction: vi.fn(async (fn: (t: Tx) => Promise<unknown>) => fn(tx)),
    lockOwner: vi.fn().mockResolvedValue(undefined),
    createWithOwner: vi.fn().mockResolvedValue(org),
    findById: vi.fn().mockResolvedValue({ ...org, ownerId: ACTOR }),
    update: vi.fn().mockResolvedValue({ ...org, name: "New" }),
    softDelete: vi.fn().mockResolvedValue(true),
    countOwned: vi.fn().mockResolvedValue(0),
    existsOwnedByName: vi.fn().mockResolvedValue(false),
    listPage: vi.fn().mockResolvedValue({ items: [org], total: 41 }),
    listOptions: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(3),
  } satisfies Record<keyof OrganizationRepository, unknown>

  const permissions = { check: vi.fn().mockResolvedValue(true) }
  const cache = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
  }
  const activityLog = { record: vi.fn().mockResolvedValue(undefined) }
  const limits = { maxOwnedPerUser: vi.fn().mockResolvedValue(2) }

  const service = createOrganizationService({
    repo: repo as unknown as OrganizationRepository,
    permissions,
    cache,
    activityLog,
    limits,
  })
  return { service, repo, permissions, cache, activityLog, limits }
}

describe("organizationService", () => {
  let t: ReturnType<typeof makeService>
  beforeEach(() => {
    t = makeService()
  })

  describe("create", () => {
    it("creates the organization, logs the activity in the same transaction", async () => {
      const result = await t.service.create(ACTOR, createInput)

      expect(result).toMatchObject({ data: { id: ORG_ID, code: "acme" } })
      expect(t.repo.createWithOwner).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: ACTOR,
          ownerUsername: "owner",
          data: expect.objectContaining({ name: "Acme" }), // trimmed
          tx,
        })
      )
      expect(t.activityLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AUDIT_EVENT_TYPES.ORGANIZATION_CREATED,
          actorId: ACTOR,
          orgId: ORG_ID,
        }),
        tx
      )
    })

    it("takes the owner lock before checking the limit and the name", async () => {
      await t.service.create(ACTOR, createInput)

      const lockOrder = t.repo.lockOwner.mock.invocationCallOrder[0]!
      expect(lockOrder).toBeLessThan(t.repo.countOwned.mock.invocationCallOrder[0]!)
      expect(lockOrder).toBeLessThan(
        t.repo.existsOwnedByName.mock.invocationCallOrder[0]!
      )
    })

    it("fails when the user is not allowed", async () => {
      t.permissions.check.mockResolvedValue(false)

      const result = await t.service.create(ACTOR, createInput)

      expect(result).toMatchObject({ error: Err.ORGANIZATION_FORBIDDEN })
      expect(t.repo.transaction).not.toHaveBeenCalled()
    })

    it("fails for a reserved code", async () => {
      const result = await t.service.create(ACTOR, { ...createInput, code: "admin" })

      expect(result).toMatchObject({ error: Err.ORGANIZATION_CODE_RESERVED })
      expect(t.repo.transaction).not.toHaveBeenCalled()
    })

    it("fails when the user reached the organization limit", async () => {
      t.repo.countOwned.mockResolvedValue(2) // max is 2

      const result = await t.service.create(ACTOR, createInput)

      expect(result).toMatchObject({ error: Err.ORGANIZATION_LIMIT_REACHED })
      expect(t.repo.createWithOwner).not.toHaveBeenCalled()
    })

    it("fails when the user already owns an organization with that name", async () => {
      t.repo.existsOwnedByName.mockResolvedValue(true)

      const result = await t.service.create(ACTOR, createInput)

      expect(result).toMatchObject({ error: Err.ORGANIZATION_NAME_TAKEN })
      expect(t.repo.createWithOwner).not.toHaveBeenCalled()
      expect(t.activityLog.record).not.toHaveBeenCalled()
    })

    it("maps a code unique-violation (race) to CODE_TAKEN", async () => {
      t.repo.createWithOwner.mockRejectedValue({
        code: "23505",
        constraint: "ux_org_code",
      })

      const result = await t.service.create(ACTOR, createInput)

      expect(result).toMatchObject({ error: Err.ORGANIZATION_CODE_TAKEN })
    })

    it("rethrows unexpected errors", async () => {
      t.repo.createWithOwner.mockRejectedValue(new Error("db down"))

      await expect(t.service.create(ACTOR, createInput)).rejects.toThrow("db down")
    })
  })

  describe("update", () => {
    it("fails when the organization does not exist", async () => {
      t.repo.findById.mockResolvedValue(null)

      const result = await t.service.update(ACTOR, ORG_ID, { name: "New" })

      expect(result).toMatchObject({ error: Err.ORGANIZATION_NOT_FOUND })
    })

    it("checks name uniqueness against the owner, excluding itself", async () => {
      await t.service.update(ACTOR, ORG_ID, { name: "New" })

      expect(t.permissions.check).toHaveBeenCalledWith(
        { userId: ACTOR },
        "update:organization",
        { resourceId: ORG_ID }
      )
      expect(t.repo.lockOwner).toHaveBeenCalledWith({ ownerId: ACTOR, tx })
      expect(t.repo.existsOwnedByName).toHaveBeenCalledWith({
        ownerId: ACTOR,
        name: "New",
        excludeId: ORG_ID,
        tx,
      })
    })

    it("fails when the new name is taken", async () => {
      t.repo.existsOwnedByName.mockResolvedValue(true)

      const result = await t.service.update(ACTOR, ORG_ID, { name: "New" })

      expect(result).toMatchObject({ error: Err.ORGANIZATION_NAME_TAKEN })
      expect(t.repo.update).not.toHaveBeenCalled()
    })

    it("skips the name check when only the case changes", async () => {
      await t.service.update(ACTOR, ORG_ID, { name: "ACME" })

      expect(t.repo.existsOwnedByName).not.toHaveBeenCalled()
      expect(t.repo.update).toHaveBeenCalled()
    })

    it("logs the activity and invalidates the cache", async () => {
      await t.service.update(ACTOR, ORG_ID, { timezone: "UTC" })

      expect(t.activityLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AUDIT_EVENT_TYPES.ORGANIZATION_UPDATED,
          metadata: { fields: ["timezone"] },
        }),
        tx
      )
      expect(t.cache.del).toHaveBeenCalledWith(`organization:${ORG_ID}`)
    })
  })

  describe("delete", () => {
    it("soft-deletes, logs and invalidates the cache", async () => {
      const result = await t.service.delete(ACTOR, ORG_ID)

      expect(result).toMatchObject({ data: { id: ORG_ID } })
      expect(t.repo.softDelete).toHaveBeenCalledWith({ id: ORG_ID, tx })
      expect(t.activityLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ type: AUDIT_EVENT_TYPES.ORGANIZATION_DELETED }),
        tx
      )
      expect(t.cache.del).toHaveBeenCalledWith(`organization:${ORG_ID}`)
    })

    it("fails when nothing was deleted", async () => {
      t.repo.softDelete.mockResolvedValue(false)

      const result = await t.service.delete(ACTOR, ORG_ID)

      expect(result).toMatchObject({ error: Err.ORGANIZATION_NOT_FOUND })
      expect(t.activityLog.record).not.toHaveBeenCalled()
    })

    it("fails when the user is not allowed", async () => {
      t.permissions.check.mockResolvedValue(false)

      const result = await t.service.delete(ACTOR, ORG_ID)

      expect(result).toMatchObject({ error: Err.ORGANIZATION_FORBIDDEN })
      expect(t.repo.softDelete).not.toHaveBeenCalled()
    })
  })

  describe("getById", () => {
    it("returns the cached value without touching the repository", async () => {
      t.cache.get.mockResolvedValue({ id: ORG_ID, name: "Cached" })

      const result = await t.service.getById(ACTOR, ORG_ID)

      expect(result).toMatchObject({ data: { name: "Cached" } })
      expect(t.repo.findById).not.toHaveBeenCalled()
    })

    it("still checks permission before serving from the cache", async () => {
      t.cache.get.mockResolvedValue({ id: ORG_ID })
      t.permissions.check.mockResolvedValue(false)

      const result = await t.service.getById(ACTOR, ORG_ID)

      expect(result).toMatchObject({ error: Err.ORGANIZATION_FORBIDDEN })
      expect(t.cache.get).not.toHaveBeenCalled()
    })

    it("loads from the repository on a miss and fills the cache", async () => {
      const result = await t.service.getById(ACTOR, ORG_ID)

      expect(result).toMatchObject({ data: { id: ORG_ID } })
      expect(t.cache.set).toHaveBeenCalledWith(
        `organization:${ORG_ID}`,
        expect.objectContaining({ id: ORG_ID }),
        expect.any(Number)
      )
    })

    it("fails when the organization does not exist", async () => {
      t.repo.findById.mockResolvedValue(null)

      const result = await t.service.getById(ACTOR, ORG_ID)

      expect(result).toMatchObject({ error: Err.ORGANIZATION_NOT_FOUND })
      expect(t.cache.set).not.toHaveBeenCalled()
    })
  })

  describe("lists", () => {
    it("offset list computes the offset and totalPages", async () => {
      const result = await t.service.getOffsetPaginationList(ACTOR, {
        page: 3,
        pageSize: 20,
      })

      expect(t.repo.listPage).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 20, offset: 40 })
      )
      expect(result).toMatchObject({
        data: { page: 3, pageSize: 20, total: 41, totalPages: 3 },
      })
    })

    it("offset list clamps the page size", async () => {
      await t.service.getOffsetPaginationList(ACTOR, { pageSize: 10_000 })

      expect(t.repo.listPage).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 })
      )
    })

    it("cursor list returns id/label items and the next cursor", async () => {
      t.repo.listOptions.mockResolvedValue([
        { id: "a", name: "Alpha" },
        { id: "b", name: "Beta" },
        { id: "c", name: "Gamma" }, // the extra row: only signals another page
      ])

      const result = await t.service.getCursorPaginationList(ACTOR, { limit: 2 })

      expect(t.repo.listOptions).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 3 })
      )
      expect(result).toMatchObject({
        data: {
          items: [
            { id: "a", label: "Alpha" },
            { id: "b", label: "Beta" },
          ],
          nextCursor: "b",
        },
      })
    })

    it("cursor list has no next cursor on the last page", async () => {
      t.repo.listOptions.mockResolvedValue([{ id: "a", name: "Alpha" }])

      const result = await t.service.getCursorPaginationList(ACTOR, { limit: 2 })

      expect(result).toMatchObject({ data: { nextCursor: null } })
    })

    it("count returns the repository count for the user", async () => {
      const result = await t.service.count(ACTOR, { status: "active" })

      expect(t.repo.count).toHaveBeenCalledWith({
        filter: { userId: ACTOR, search: undefined, status: "active" },
      })
      expect(result).toMatchObject({ data: { count: 3 } })
    })
  })
})
