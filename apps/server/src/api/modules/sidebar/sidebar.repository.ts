import { and, asc, eq } from "drizzle-orm"
import { sidebarHeadings, sidebarOptions, type DB, type Tx } from "@avuny/db"
import type { SidebarHeadingType, SidebarOptionName } from "@avuny/contracts"

/** One row per active option, joined with its active heading. JSON-safe (cacheable). */
export interface SidebarCatalogRow {
  headingId: string
  headingName: SidebarHeadingType
  headingIcon: string
  optionId: string
  optionName: SidebarOptionName
  optionIcon: string | null
  optionPath: string
}

export function createSidebarRepository({ db }: { db: DB }) {
  const exec = (tx?: Tx): DB | Tx => tx ?? db

  /**
   * Active headings x active options.
   * Ordering relies on Postgres enum order (declaration order of the pgEnums),
   * so headings/options appear in the order they are listed in the enum.
   */
  async function listActiveCatalog(tx?: Tx): Promise<SidebarCatalogRow[]> {
    return exec(tx)
      .select({
        headingId: sidebarHeadings.id,
        headingName: sidebarHeadings.name,
        headingIcon: sidebarHeadings.icon,
        optionId: sidebarOptions.id,
        optionName: sidebarOptions.name,
        optionIcon: sidebarOptions.icon,
        optionPath: sidebarOptions.path,
      })
      .from(sidebarOptions)
      .innerJoin(
        sidebarHeadings,
        eq(sidebarOptions.sidebarHeadingId, sidebarHeadings.id)
      )
      .where(and(eq(sidebarHeadings.isActive, true), eq(sidebarOptions.isActive, true)))
      .orderBy(asc(sidebarHeadings.name), asc(sidebarOptions.name))
  }

  return { listActiveCatalog }
}

export type SidebarRepository = ReturnType<typeof createSidebarRepository>
