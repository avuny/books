import { describe, it, expect, vi } from "vitest"
import { SIDEBAR_TREE } from "@avuny/contracts"
import {
  createSidebarService,
  SIDEBAR_CATALOG_CACHE_KEY,
  type SidebarCache,
} from "./sidebar.service.js"
import type { SidebarCatalogRow } from "./sidebar.repository.js"
import { createPermissionCheckerGate } from "./sidebar.permissions.js"

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

// Deliberately NOT in sidebar order: the registry decides the order, not the database.
const catalog: SidebarCatalogRow[] = [
  row("inventory", "item"),
  row("users", "organizationUser"),
  row("users", "role"),
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
  const service = createSidebarService({ repository, gate, cache })
  return { service, repository, gate }
}

const unwrap = <T>(r: { success: boolean; data?: T }): T => {
  if (!r.success || !("data" in r)) throw new Error("Expected success")
  return r.data as T
}

describe("sidebarService.getForUser", () => {
  it("keeps only permitted options and drops headings left with none", async () => {
    const { service } = build(["read:role", "delete:item"])
    const result = await service.getForUser(input)
    const data = unwrap(result)

    expect(data.map((h) => h.name)).toEqual(["users", "inventory"])
    expect(data[0]!.options.map((o) => o.name)).toEqual(["role"])
    expect(data[1]!.options.map((o) => o.name)).toEqual(["item"])
  })

  it("a single action (even delete) is enough to show an option", async () => {
    const { service } = build(["delete:item"])
    const result = await service.getForUser(input)
    expect(unwrap(result)).toHaveLength(1)
    expect(unwrap(result)[0]!.name).toBe("inventory")
  })

  it("any action the module defines counts, not only create/read/update/delete", async () => {
    const { service } = build(["deactivate:organization-user"])
    const data = unwrap(await service.getForUser(input))
    expect(data.flatMap((h) => h.options.map((o) => o.name))).toEqual(["organizationUser"])
  })

  it("returns an empty sidebar when the user has no permissions", async () => {
    const { service } = build([])
    const result = await service.getForUser(input)
    expect(unwrap(result)).toEqual([])
  })

  it("returns everything in registry order, whatever order the database returns", async () => {
    const all = SIDEBAR_TREE.flatMap((h) => h.options).flatMap((o) => o.permissionKeys)
    const { service } = build(all)
    const data = unwrap(await service.getForUser(input))
    expect(data.map((h) => h.name)).toEqual(["users", "inventory"])
    expect(data.flatMap((h) => h.options.map((o) => o.name))).toEqual([
      "role",
      "organizationUser",
      "item",
    ])
  })

  it("asks the gate for every grantable action of the option's module", async () => {
    const { service, gate } = build([], [row("users", "organizationUser")])
    await service.getForUser(input)
    expect(gate.hasAny).toHaveBeenCalledWith({ userId: "u1", orgId: "org1" }, [
      "read:organization-user",
      "update:organization-user",
      "deactivate:organization-user",
    ])
  })

  it("localizes labels and falls back to English", async () => {
    const { service } = build(["read:role"])
    const ar = unwrap(await service.getForUser({ ...input, lang: "ar-EG" }))
    expect(ar[0]!.label).toBe("المستخدمون")
    expect(ar[0]!.options[0]!.label).toBe("الأدوار")
    const xx = unwrap(await service.getForUser({ ...input, lang: "xx" }))
    expect(xx[0]!.label).toBe("Users")
    expect(xx[0]!.options[0]!.label).toBe("Roles")
  })

  it("ignores catalog rows the registry no longer knows (until the next seed removes them)", async () => {
    const stale = row("users", "legacyThing" as SidebarCatalogRow["optionName"])
    const { service, gate } = build(["read:role"], [row("users", "role"), stale])
    const data = unwrap(await service.getForUser(input))
    expect(data.flatMap((h) => h.options.map((o) => o.name))).toEqual(["role"])
    expect(gate.hasAny).toHaveBeenCalledTimes(1)
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
      const { service, repository } = build(["read:role"], catalog, cache)
      await service.getForUser(input)
      await service.getForUser(input)
      expect(repository.listActiveCatalog).toHaveBeenCalledTimes(1)
    })

    it("invalidateCatalog forces a reload", async () => {
      const cache = memoryCache()
      const { service, repository } = build(["read:role"], catalog, cache)
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
        del: async () => { },
      }
      const { service } = build(["read:role"], catalog, broken)
      expect(unwrap(await service.getForUser(input))).toHaveLength(1)
    })

    it("never caches the per-user result", async () => {
      const cache = memoryCache()
      const { service } = build(["read:role"], catalog, cache)
      await service.getForUser(input)
      expect([...cache.store.keys()]).toEqual([SIDEBAR_CATALOG_CACHE_KEY])
    })
  })
})

describe("createPermissionCheckerGate", () => {
  it("stops at the first granted key", async () => {
    const check = vi.fn(async (_s: unknown, key: string) => key === "read:role")
    const gate = createPermissionCheckerGate({ check } as never)
    expect(
      await gate.hasAny({ userId: "u", orgId: "o" }, ["read:role", "create:role"])
    ).toBe(true)
    expect(check).toHaveBeenCalledTimes(1)
  })

  it("returns false when nothing is granted", async () => {
    const check = vi.fn(async () => false)
    const gate = createPermissionCheckerGate({ check } as never)
    expect(
      await gate.hasAny({ userId: "u", orgId: "o" }, ["read:role", "create:role"])
    ).toBe(false)
    expect(check).toHaveBeenCalledTimes(2)
  })
})
