import { notInArray } from "drizzle-orm"
import { sidebarHeadings, sidebarOptions, type DB } from "@avuny/db"
import type { SidebarHeadingType, SidebarOptionName } from "@avuny/contracts"

export interface SidebarSeedOption {
  name: SidebarOptionName
  /** Icon key understood by the web app (lucide names here). */
  icon: string | null
  /** Org-relative path; the web app prefixes it with the active organization. */
  path: string
}

export interface SidebarSeedHeading {
  name: SidebarHeadingType
  icon: string
  options: readonly SidebarSeedOption[]
}

/** Every SidebarOptionName must appear at most once in the seed. */
export const SIDEBAR_SEED: readonly SidebarSeedHeading[] = [
  {
    name: "users",
    icon: "users",
    options: [
      { name: "role", icon: "shield-check", path: "/role" },
      { name: "organizationUser", icon: "users-round", path: "/users" },
    ],
  },
  {
    name: "purchases",
    icon: "shopping-cart",
    options: [
      { name: "supplier", icon: "truck", path: "/suppliers" },
      {
        name: "purchaseOrder",
        icon: "clipboard-list",
        path: "/purchase-orders",
      },
    ],
  },
  {
    name: "sales",
    icon: "badge-dollar-sign",
    options: [
      { name: "customer", icon: "contact", path: "/customers" },
      { name: "salesOrder", icon: "shopping-bag", path: "/sales-orders" },
      { name: "invoice", icon: "file-text", path: "/invoices" },
      { name: "receipt", icon: "receipt", path: "/receipts" },
      { name: "report", icon: "chart-column", path: "/reports" },
    ],
  },
  {
    name: "inventory",
    icon: "boxes",
    options: [
      { name: "item", icon: "package", path: "/items" },
      { name: "unit", icon: "ruler", path: "/units" },
      { name: "unitCollection", icon: "layers", path: "/unit-collections" },
      { name: "warehouse", icon: "warehouse", path: "/warehouses" },
    ],
  },
]

export interface SeedSidebarSummary {
  headings: number
  options: number
  headingsRemoved: number
  optionsRemoved: number
}

/**
 * Idempotent & synchronizing: safe to run on every deploy or manually.
 * - Upserts seeded headings and options by unique `name`.
 * - Removes options & headings in the database that are no longer in `SIDEBAR_SEED`.
 * - Refreshes icon / path / heading associations.
 */
export async function seedSidebar({
  db,
}: {
  db: DB
}): Promise<SeedSidebarSummary> {
  let headings = 0
  let options = 0
  let headingsRemoved = 0
  let optionsRemoved = 0

  const targetHeadingNames = SIDEBAR_SEED.map((h) => h.name)
  const targetOptionNames = SIDEBAR_SEED.flatMap((h) =>
    h.options.map((o) => o.name)
  )

  await db.transaction(async (tx) => {
    // 1. Delete options removed from the seed definition
    if (targetOptionNames.length > 0) {
      const deletedOptions = await tx
        .delete(sidebarOptions)
        .where(notInArray(sidebarOptions.name, targetOptionNames))
        .returning({ id: sidebarOptions.id })
      optionsRemoved = deletedOptions.length
    } else {
      const deletedOptions = await tx
        .delete(sidebarOptions)
        .returning({ id: sidebarOptions.id })
      optionsRemoved = deletedOptions.length
    }

    // 2. Delete headings removed from the seed definition
    if (targetHeadingNames.length > 0) {
      const deletedHeadings = await tx
        .delete(sidebarHeadings)
        .where(notInArray(sidebarHeadings.name, targetHeadingNames))
        .returning({ id: sidebarHeadings.id })
      headingsRemoved = deletedHeadings.length
    } else {
      const deletedHeadings = await tx
        .delete(sidebarHeadings)
        .returning({ id: sidebarHeadings.id })
      headingsRemoved = deletedHeadings.length
    }

    // 3. Upsert headings and options from the seed
    for (const heading of SIDEBAR_SEED) {
      const now = new Date()
      const [row] = await tx
        .insert(sidebarHeadings)
        .values({ name: heading.name, icon: heading.icon, updatedAt: now })
        .onConflictDoUpdate({
          target: sidebarHeadings.name,
          set: { icon: heading.icon, updatedAt: now },
        })
        .returning({ id: sidebarHeadings.id })

      if (!row)
        throw new Error(`Failed to upsert sidebar heading "${heading.name}"`)
      headings++

      for (const option of heading.options) {
        await tx
          .insert(sidebarOptions)
          .values({
            name: option.name,
            icon: option.icon,
            path: option.path,
            sidebarHeadingId: row.id,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: sidebarOptions.name,
            set: {
              icon: option.icon,
              path: option.path,
              sidebarHeadingId: row.id,
              updatedAt: now,
            },
          })
        options++
      }
    }
  })

  return { headings, options, headingsRemoved, optionsRemoved }
}

if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("sidebar.seed.ts")
) {
  const { db } = await import("../../db.js")
  console.log("Seeding sidebar...")
  const result = await seedSidebar({ db })
  console.log(
    `Seeded sidebar: ${result.headings} headings, ${result.options} options. Removed: ${result.headingsRemoved} headings, ${result.optionsRemoved} options.`
  )
  process.exit(0)
}
