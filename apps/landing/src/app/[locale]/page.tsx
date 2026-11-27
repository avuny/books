import { renderBlock } from "@/blocks"
import { loadSnapshot } from "@/lib/content"
import type { Locale } from "@/lib/snapshot"

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const snapshot = await loadSnapshot(locale as Locale)
  return <main>{snapshot.blocks.map(renderBlock)}</main>
}
