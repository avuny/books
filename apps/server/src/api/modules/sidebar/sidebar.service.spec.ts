import { describe, it, expect, vi } from "vitest"
import { SidebarHeadingType, SidebarOptionName } from "@avuny/contracts"
import { sidebarHeadingTypeEnum, sidebarOptionNameEnum } from "@avuny/db"
import {
  createSidebarService,
  SIDEBAR_CATALOG_CACHE_KEY,
  type SidebarCache,
} from "./sidebar.service.js"
import type { SidebarCatalogRow } from "./sidebar.repository.js"
import {
  createSidebarPermissionMapper,
  sidebarOptionResources,
} from "./sidebar.permission-map.js"
import { createPermissionCheckerGate } from "./sidebar.permissions.js"
import { SIDEBAR_SEED } from "./sidebar.seed.js"

const row = (
  headingName: SidebarCatalogRow["headingName"],
  optionName: SidebarCatalogRow["optionName"],
  path = `/${optionName}`
): SidebarCatalogRow => ({
  headingId: `h-${headingName}`,
  headingName,
  headingIcon: `${headingName}-icon`,
  optionId: `o-${optionName}`,
  optionName,
  optionIcon: null,
  optionPath: path,
})

const catalog: SidebarCatalogRow[] = [
  row("users", "user"),
  row("users", "role"),
  row("sales", "customer"),
  row("sales", "invoice"),
  row("inventory", "item"),
]

const input = { userId: "u1", orgId: "org1" }

/** Gate that grants exactly the given permission keys. */
function gateFor(granted: string[]) {
  return {
    hasAny: vi.fn(async (_s: unknown, keys: readonly string[]) =>
      keys.some((k) => granted.includes(k))
    ),
  }
}

function build(granted: string[], rows = catalog, cache?: SidebarCache) {
  const repository = { listActiveCatalog: vi.fn(async () => rows) }
  const gate = gateFor(granted)
  const service = createSidebarService({
    repository,
    permissionMapper: createSidebarPermissionMapper(),
    gate,
    cache,
  })
  return { service, repository, gate }
}

const unwrap = <T>(r: { success: boolean; data?: T }): T => {
  if (!r.success || !("data" in r)) throw new Error("Expected success")
  return r.data as T
}

describe("sidebarService.getForUser", () => {
  it("keeps only permitted options and drops headings left with none", async () => {
    const { service } = build(["read:role", "create:invoice"])
    const result = await service.getForUser(input)
    const data = unwrap(result)

    expect(data.map((h) => h.name)).toEqual(["users", "sales"])
    expect(data[0]!.options.map((o) => o.name)).toEqual(["role"])
    expect(data[1]!.options.map((o) => o.name)).toEqual(["invoice"])
  })

  it("a single action (even delete) is enough to show an option", async () => {
    const { service } = build(["delete:item"])
    const result = await service.getForUser(input)
    expect(unwrap(result)).toHaveLength(1)
    expect(unwrap(result)[0]!.name).toBe("inventory")
  })

  it("returns an empty sidebar when the user has no permissions", async () => {
    const { service } = build([])
    const result = await service.getForUser(input)
    expect(unwrap(result)).toEqual([])
  })

  it("returns everything, in catalog order, for a user allowed on all resources", async () => {
    const all = Object.values(sidebarOptionResources).map((r) => `read:${r}`)
    const { service } = build(all)
    const result = await service.getForUser(input)
    const data = unwrap(result)
    expect(data.map((h) => h.name)).toEqual(["users", "sales", "inventory"])
    expect(data.flatMap((h) => h.options.map((o) => o.name))).toEqual([
      "user",
      "role",
      "customer",
      "invoice",
      "item",
    ])
  })

  it("maps option -> permission keys (kebab-case resource, every action)", async () => {
    const { service, gate } = build([], [row("users", "organizationUser")])
    await service.getForUser(input)
    expect(gate.hasAny).toHaveBeenCalledWith({ userId: "u1", orgId: "org1" }, [
      "read:organization-user",
      "create:organization-user",
      "update:organization-user",
      "delete:organization-user",
    ])
  })

  it("localizes labels and falls back to English", async () => {
    const { service } = build(["read:user"])
    const ar = await service.getForUser({ ...input, lang: "ar-EG" })
    expect(unwrap(ar)[0]!.label).toBe("المستخدمون")
    const xx = await service.getForUser({ ...input, lang: "xx" })
    expect(unwrap(xx)[0]!.label).toBe("Users")
  })

  it("hides options that have no permission mapping", async () => {
    const rows = [row("users", "user")]
    const service = createSidebarService({
      repository: { listActiveCatalog: vi.fn(async () => rows) },
      permissionMapper: { keysFor: () => [] },
      gate: gateFor(["read:user"]),
    })
    expect(unwrap(await service.getForUser(input))).toEqual([])
  })

  describe("catalog cache", () => {
    function memoryCache(): SidebarCache & { store: Map<string, unknown> } {
      const store = new Map<string, unknown>()
      return {
        store,
        get: async <T>(k: string) => (store.get(k) as T | undefined) ?? null,
        set: async (k, v) => void store.set(k, v),
        del: async (k) => void store.delete(k),
      }
    }

    it("hits the repository once, then serves the catalog from cache", async () => {
      const cache = memoryCache()
      const { service, repository } = build(["read:user"], catalog, cache)
      await service.getForUser(input)
      await service.getForUser(input)
      expect(repository.listActiveCatalog).toHaveBeenCalledTimes(1)
    })

    it("invalidateCatalog forces a reload", async () => {
      const cache = memoryCache()
      const { service, repository } = build(["read:user"], catalog, cache)
      await service.getForUser(input)
      await service.invalidateCatalog()
      expect(cache.store.has(SIDEBAR_CATALOG_CACHE_KEY)).toBe(false)
      await service.getForUser(input)
      expect(repository.listActiveCatalog).toHaveBeenCalledTimes(2)
    })

    it("still works when the cache throws", async () => {
      const broken: SidebarCache = {
        get: async () => {
          throw new Error("down")
        },
        set: async () => {
          throw new Error("down")
        },
        del: async () => {},
      }
      const { service } = build(["read:user"], catalog, broken)
      expect(unwrap(await service.getForUser(input))).toHaveLength(1)
    })

    it("never caches the per-user result", async () => {
      const cache = memoryCache()
      const { service } = build(["read:user"], catalog, cache)
      await service.getForUser(input)
      expect([...cache.store.keys()]).toEqual([SIDEBAR_CATALOG_CACHE_KEY])
    })
  })
})

describe("createPermissionCheckerGate", () => {
  it("stops at the first granted key", async () => {
    const check = vi.fn(async (_s: unknown, key: string) => key === "read:user")
    const gate = createPermissionCheckerGate({ check } as never)
    expect(
      await gate.hasAny({ userId: "u", orgId: "o" }, [
        "read:user",
        "create:user",
      ])
    ).toBe(true)
    expect(check).toHaveBeenCalledTimes(1)
  })

  it("returns false when nothing is granted", async () => {
    const check = vi.fn(async () => false)
    const gate = createPermissionCheckerGate({ check } as never)
    expect(
      await gate.hasAny({ userId: "u", orgId: "o" }, [
        "read:user",
        "create:user",
      ])
    ).toBe(false)
    expect(check).toHaveBeenCalledTimes(2)
  })
})

describe("catalog integrity", () => {
  it("contract enums match the DB enums", () => {
    expect([...SidebarHeadingType]).toEqual(sidebarHeadingTypeEnum.enumValues)
    expect([...SidebarOptionName]).toEqual(sidebarOptionNameEnum.enumValues)
  })

  it("every seeded option has a permission resource and appears at most once", () => {
    const seeded = SIDEBAR_SEED.flatMap((h) => h.options.map((o) => o.name))
    const unique = new Set(seeded)
    expect(unique.size).toBe(seeded.length)
    for (const name of seeded) {
      expect(sidebarOptionResources[name]).toBeTruthy()
    }
  })

  it("seed headings cover every heading type once", () => {
    expect(SIDEBAR_SEED.map((h) => h.name).sort()).toEqual(
      [...SidebarHeadingType].sort()
    )
  })
})
