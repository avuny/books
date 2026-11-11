import { notInArray } from "drizzle-orm"
import { SIDEBAR_TREE } from "@avuny/contracts"
import { sidebarHeadings, sidebarOptions, type DB } from "@avuny/db"

export interface SeedSidebarSummary {
  headings: number
  options: number
  headingsRemoved: number
  optionsRemoved: number
}

/**
 * Idempotent & synchronizing: safe to run on every deploy or manually.
 * The data is not written here: SIDEBAR_TREE is derived from the module registry
 * (@avuny/contracts), so a module with a `sidebar` entry is seeded automatically.
 * - Upserts seeded headings and options by unique `name`.
 * - Removes options & headings in the database that are no longer in the registry.
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

  const targetHeadingNames = SIDEBAR_TREE.map((h) => h.name)
  const targetOptionNames = SIDEBAR_TREE.flatMap((h) =>
    h.options.map((o) => o.name)
  )

  await db.transaction(async (tx) => {
    // 1. Delete options removed from the registry
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

    // 2. Delete headings removed from the registry
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

    // 3. Upsert headings and options from the registry
    for (const heading of SIDEBAR_TREE) {
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
