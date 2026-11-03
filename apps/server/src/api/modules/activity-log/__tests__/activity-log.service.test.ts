import type { Tx } from "@avuny/db"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createActivityLogService } from "../activity-log.service.js"
import type { ActivityLogEntry } from "../activity-log.port.js"
import type { ActivityLogRepository } from "../activity-log.repository.js"

vi.mock("@avuny/logger", () => ({ logger: { error: vi.fn() } }))
import { logger } from "@avuny/logger"

const entry: ActivityLogEntry = {
  action: "organization_user.username_changed",
  resource: "organization_user",
  resourceId: "11111111-1111-4111-8111-111111111111",
  orgId: "22222222-2222-4222-8222-222222222222",
  actorId: "33333333-3333-4333-8333-333333333333",
  metadata: { from: "a", to: "b" },
}

function setup(allowed = true) {
  const repository = {
    insert: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  } satisfies ActivityLogRepository
  const permissions = { check: vi.fn().mockResolvedValue(allowed) }
  return { repository, permissions, service: createActivityLogService({ repository, permissions }) }
}

beforeEach(() => vi.clearAllMocks())

describe("log", () => {
  it("writes a row with defaults for the optional fields", async () => {
    const { service, repository } = setup()
    await service.log({ ...entry, metadata: undefined })
    expect(repository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: entry.orgId,
        action: entry.action,
        resource: "organization_user",
        resourceId: entry.resourceId,
        metadata: {},
        requestId: null,
      })
    )
  })

  it("infers resource from action if resource is omitted", async () => {
    const { service, repository } = setup()
    await service.log({
      action: "organization_invitation.created",
      resourceId: "11111111-1111-4111-8111-111111111111",
      orgId: entry.orgId,
      actorId: entry.actorId,
    })
    expect(repository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "organization_invitation.created",
        resource: "organization_invitation",
        resourceId: "11111111-1111-4111-8111-111111111111",
      })
    )
  })

  it("swallows and logs a write failure when there is no transaction", async () => {
    const { service, repository } = setup()
    repository.insert.mockRejectedValue(new Error("db down"))
    await expect(service.log(entry)).resolves.toBeUndefined()
    expect(logger.error).toHaveBeenCalledOnce()
  })

  it("joins the caller's transaction and propagates failures", async () => {
    const { service, repository } = setup()
    const tx = {} as Tx
    await service.log(entry, { tx })
    expect(repository.insert).toHaveBeenCalledWith(expect.anything(), tx)

    repository.insert.mockRejectedValue(new Error("db down"))
    await expect(service.log(entry, { tx })).rejects.toThrow("db down")
  })

  it("never writes an entry with a blank action", async () => {
    const { service, repository } = setup()
    await service.log({ ...entry, action: "  " as any })
    expect(repository.insert).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledOnce()
    await expect(service.log({ ...entry, action: "  " as any }, { tx: {} as Tx })).rejects.toThrow()
  })
})

describe("list", () => {
  const query = { page: 1, pageSize: 20 }

  it("is forbidden without the permission and never reads", async () => {
    const { service, repository } = setup(false)
    const res = await service.list(entry.actorId!, entry.orgId, query)
    expect(res.success).toBe(false)
    expect(repository.list).not.toHaveBeenCalled()
  })

  it("rejects an inverted date range", async () => {
    const { service, repository } = setup()
    const res = await service.list(entry.actorId!, entry.orgId, {
      ...query,
      from: new Date("2026-02-01"),
      to: new Date("2026-01-01"),
    })
    expect(res.success).toBe(false)
    expect(repository.list).not.toHaveBeenCalled()
  })

  it("maps rows to DTOs with pagination", async () => {
    const { service, repository } = setup()
    repository.list.mockResolvedValue({
      rows: [
        {
          actorUsername: "sara",
          log: {
            id: "44444444-4444-4444-8444-444444444444",
            ...entry,
            resource: entry.resource!,
            metadata: entry.metadata ?? {},
            requestId: null,
            ipAddress: "10.0.0.1",
            userAgent: "x",
            createdAt: new Date("2026-01-01T00:00:00Z"),
          },
        },
      ],
      total: 1,
    })
    const res = await service.list(entry.actorId!, entry.orgId, query)
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data).toMatchObject({ page: 1, pageSize: 20, total: 1 })
    expect(res.data.items[0]).toMatchObject({
      actorUsername: "sara",
      action: "organization_user.username_changed",
      resource: "organization_user",
      resourceId: "11111111-1111-4111-8111-111111111111",
      createdAt: "2026-01-01T00:00:00.000Z",
    })
    // forensic fields are not exposed
    expect(res.data.items[0]).not.toHaveProperty("ipAddress")
  })
})
