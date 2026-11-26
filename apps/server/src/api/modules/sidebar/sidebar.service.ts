import { ok, type Result } from "@avuny/utils"
import {
  getSidebarLabels,
  SIDEBAR_TREE,
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

/** Every sidebar option in display order, from the module registry. */
const OPTIONS = SIDEBAR_TREE.flatMap((heading) =>
  heading.options.map((option) => ({ heading: heading.name, option }))
)

export interface SidebarServiceDeps {
  repository: Pick<SidebarRepository, "listActiveCatalog">
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
   *  - the registry decides which options exist, their order and the permissions that show
   *    them; the database only supplies ids and the active flag (a row the registry no
   *    longer knows is ignored until the next seed removes it);
   *  - an option is kept if the user holds at least one of its module's grantable actions;
   *  - a heading is kept only if at least one of its options is kept.
   */
  async function getForUser({
    userId,
    orgId,
    lang,
  }: GetSidebarInput): Promise<Result<SidebarDto, never>> {
    const rowByOption = new Map(
      (await loadCatalog()).map((row) => [row.optionName, row] as const)
    )
    const candidates = OPTIONS.flatMap(({ heading, option }) => {
      const row = rowByOption.get(option.name)
      return row ? [{ heading, option, row }] : []
    })

    const subject = { userId, orgId }
    const allowed = await Promise.all(
      candidates.map(({ option }) => gate.hasAny(subject, option.permissionKeys))
    )

    const labels = getSidebarLabels(lang)
    const items = new Map<string, SidebarItemDto>()

    candidates.forEach(({ heading, option, row }, i) => {
      if (!allowed[i]) return

      let item = items.get(row.headingId)
      if (!item) {
        item = {
          id: row.headingId,
          name: heading,
          label: labels.headings[heading],
          icon: row.headingIcon,
          options: [],
        }
        items.set(row.headingId, item)
      }

      item.options.push({
        id: row.optionId,
        name: option.name,
        label: labels.options[option.name],
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
    gate: createPermissionCheckerGate(),
    cache: new DummyCache(),
  })
}

export const sidebarService = createDefaultSidebarService()
