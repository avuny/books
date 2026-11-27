import { z } from "@avuny/zod"

// Snapshot schema (LANDING-SPEC 3 and 4.2). TEMPORARY LOCAL COPY: move to
// @avuny/contracts (a `site` module) when the platform-server public API is built,
// so the server and this app share one definition.

export const LOCALES = ["en", "ar"] as const
export type Locale = (typeof LOCALES)[number]

const text = z.string().min(1)
const cta = z.object({ label: text, href: text })
const media = z.object({ url: text, alt: text, width: z.number().int().positive(), height: z.number().int().positive() })

export const blockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hero"),
    headline: text,
    subheadline: text,
    primaryCta: cta,
    secondaryCta: cta.optional(),
    media: media.optional(),
    badges: z.array(text).default([]),
  }),
  z.object({
    type: z.literal("feature_grid"),
    heading: text,
    items: z.array(z.object({ icon: text, title: text, text })),
  }),
  z.object({
    type: z.literal("cta_banner"),
    headline: text,
    text,
    cta,
  }),
])
export type Block = z.infer<typeof blockSchema>

export const snapshotSchema = z.object({
  schemaVersion: z.literal(1),
  contentHash: text,
  locale: z.enum(LOCALES),
  isSample: z.boolean().default(false),
  settings: z.object({ siteName: text, description: text }),
  blocks: z.array(z.unknown()),
  plans: z
    .array(z.object({ key: text, name: text, prices: z.record(z.string(), z.number()) }))
    .default([]),
})
export type Snapshot = Omit<z.infer<typeof snapshotSchema>, "blocks"> & { blocks: Block[] }
