import { blockSchema, snapshotSchema, type Block, type Locale, type Snapshot } from "./snapshot"

import fixtureEn from "@/content/fixture.en.json"
import fixtureAr from "@/content/fixture.ar.json"

const fixtures: Record<Locale, unknown> = { en: fixtureEn, ar: fixtureAr }

/** Parse and validate a raw snapshot. Throws on a bad snapshot so the build fails (LAC8). */
export function parseSnapshot(raw: unknown): Snapshot {
  const base = snapshotSchema.parse(raw)
  const blocks: Block[] = []
  for (const candidate of base.blocks) {
    const known = blockSchema.safeParse(candidate)
    if (known.success) {
      blocks.push(known.data)
      continue
    }
    const type = (candidate as { type?: unknown } | null)?.type
    if (typeof type === "string" && !isKnownType(type)) {
      console.warn(`[landing] skipping unknown block type "${type}"`)
      continue
    }
    throw new Error(`[landing] invalid block "${String(type)}": ${known.error.message}`)
  }
  return { ...base, blocks }
}

function isKnownType(type: string) {
  return blockSchema.options.some((o) => o.shape.type.value === type)
}

/** Build-time load: PLATFORM_API_URL when set, otherwise the sample fixture. */
export async function loadSnapshot(locale: Locale): Promise<Snapshot> {
  const base = process.env.PLATFORM_API_URL
  if (!base) return parseSnapshot(fixtures[locale])
  const res = await fetch(`${base.replace(/\/$/, "")}/public/site/${locale}`)
  if (!res.ok) throw new Error(`[landing] snapshot fetch failed: ${res.status}`)
  return parseSnapshot(await res.json())
}
