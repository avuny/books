import { ok, type Result } from "@avuny/utils"
import {
  getSidebarLabels,
  type SidebarDto,
  type SidebarItemDto,
} from "@avuny/contracts"
import { db } from "../../db.js"
import {
  createSidebarRepository,
  type SidebarCatalogRow,
  type SidebarRepository,
} from "./sidebar.repository.js"
import {
  sidebarPermissionMapper,
  type SidebarPermissionMapper,
} from "./sidebar.permission-map.js"
import {
  createPermissionCheckerGate,
  type SidebarPermissionGate,
} from "./sidebar.permissions.js"

// ---------- Ports ----------

export interface SidebarCache {
  get<T>(key: string): Promise<T | null>
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>
  del(key: string): Promise<void>
}

export class DummyCache implements SidebarCache {
  async get<T>(): Promise<T | null> {
    return null
  }
  async set(): Promise<void> {}
  async del(): Promise<void> {}
}

// ---------- Service ----------

export const SIDEBAR_CATALOG_CACHE_KEY = "sidebar:catalog"
export const SIDEBAR_CATALOG_TTL_SECONDS = 60

export interface SidebarServiceDeps {
  repository: Pick<SidebarRepository, "listActiveCatalog">
  permissionMapper: SidebarPermissionMapper
  gate: SidebarPermissionGate
  cache?: SidebarCache
}

export interface GetSidebarInput {
  userId: string
  orgId: string
  /** Request locale, e.g. "en" | "ar" | "ar-EG". Unknown -> "en". */
  lang?: string
}

export function createSidebarService({
  repository,
  permissionMapper,
  gate,
  cache = new DummyCache(),
}: SidebarServiceDeps) {
  /** Headings/options rarely change, so the catalog (not the per-user result) is cached. */
  async function loadCatalog(): Promise<SidebarCatalogRow[]> {
    try {
      const cached = await cache.get<SidebarCatalogRow[]>(SIDEBAR_CATALOG_CACHE_KEY)
      if (cached) return cached
    } catch {
      // cache is best-effort
    }
    const rows = await repository.listActiveCatalog()
    try {
      await cache.set(SIDEBAR_CATALOG_CACHE_KEY, rows, SIDEBAR_CATALOG_TTL_SECONDS)
    } catch {
      // cache is best-effort
    }
    return rows
  }

  /**
   * Sidebar for a user inside an organization:
   *  - an option is kept if the user has at least one action (read/create/update/delete)
   *    on its mapped resource;
   *  - a heading is kept only if at least one of its options is kept.
   * Order follows the catalog order.
   */
  async function getForUser({
    userId,
    orgId,
    lang,
  }: GetSidebarInput): Promise<Result<SidebarDto, never>> {
    const rows = await loadCatalog()
    const subject = { userId, orgId }

    const allowed = await Promise.all(
      rows.map((row) => gate.hasAny(subject, permissionMapper.keysFor(row.optionName)))
    )

    const labels = getSidebarLabels(lang)
    const items = new Map<string, SidebarItemDto>()

    rows.forEach((row, i) => {
      if (!allowed[i]) return

      let item = items.get(row.headingId)
      if (!item) {
        item = {
          id: row.headingId,
          name: row.headingName,
          label: labels.headings[row.headingName],
          icon: row.headingIcon,
          options: [],
        }
        items.set(row.headingId, item)
      }

      item.options.push({
        id: row.optionId,
        name: row.optionName,
        label: labels.options[row.optionName],
        icon: row.optionIcon,
        path: row.optionPath,
      })
    })

    return ok({
      data: [...items.values()],
      msg: "Sidebar retrieved successfully",
    })
  }

  /** Call after seeding / editing headings or options. */
  async function invalidateCatalog(): Promise<void> {
    await cache.del(SIDEBAR_CATALOG_CACHE_KEY)
  }

  return { getForUser, invalidateCatalog }
}

export type SidebarService = ReturnType<typeof createSidebarService>

export function createDefaultSidebarService(): SidebarService {
  return createSidebarService({
    repository: createSidebarRepository({ db }),
    permissionMapper: sidebarPermissionMapper,
    gate: createPermissionCheckerGate(),
    cache: new DummyCache(),
  })
}

export const sidebarService = createDefaultSidebarService()
