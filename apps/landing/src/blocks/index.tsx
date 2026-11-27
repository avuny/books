import type { Block } from "@/lib/snapshot"

type Of<T extends Block["type"]> = Extract<Block, { type: T }>

function Hero({ b }: { b: Of<"hero"> }) {
  return (
    <section className="hero-bg relative overflow-hidden px-6 py-28 text-center">
      <div className="reveal mx-auto max-w-3xl">
        <div className="mb-4 flex flex-wrap justify-center gap-2">
          {b.badges.map((x) => (
            <span key={x} className="rounded-full border px-3 py-1 text-xs backdrop-blur">{x}</span>
          ))}
        </div>
        <h1 className="text-5xl font-semibold tracking-tight">{b.headline}</h1>
        <p className="mt-4 text-lg opacity-80">{b.subheadline}</p>
        <a href={b.primaryCta.href} className="mt-8 inline-block rounded-lg bg-black px-6 py-3 text-white">
          {b.primaryCta.label}
        </a>
      </div>
    </section>
  )
}

function FeatureGrid({ b }: { b: Of<"feature_grid"> }) {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <h2 className="reveal mb-10 text-3xl font-semibold">{b.heading}</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {b.items.map((i) => (
          <div key={i.title} className="reveal rounded-xl border p-6 backdrop-blur">
            <h3 className="font-medium">{i.title}</h3>
            <p className="mt-2 text-sm opacity-80">{i.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function CtaBanner({ b }: { b: Of<"cta_banner"> }) {
  return (
    <section className="px-6 py-20 text-center">
      <h2 className="reveal text-3xl font-semibold">{b.headline}</h2>
      <p className="mt-3 opacity-80">{b.text}</p>
      <a href={b.cta.href} className="mt-6 inline-block rounded-lg border px-6 py-3">{b.cta.label}</a>
    </section>
  )
}

/** Registry: block type -> component. Add one entry per new block type. */
export function renderBlock(block: Block, key: number) {
  switch (block.type) {
    case "hero": return <Hero key={key} b={block} />
    case "feature_grid": return <FeatureGrid key={key} b={block} />
    case "cta_banner": return <CtaBanner key={key} b={block} />
  }
}
