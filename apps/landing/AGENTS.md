# AGENTS.md (apps/landing)

The public marketing site (Next.js, static export). **Scaffold only**: a snapshot loader with schema validation, three placeholder blocks (hero, feature grid, CTA banner), `en` and `ar` routes with RTL. No real marketing content.

Spec: `docs/modules/saas-architecture/LANDING-SPEC.md`. Status: `PROGRESS.md` (landing track L1 to L5).

## Rules
1. **No marketing text, image URL or price in the app source** (LAC1). Everything comes from the published site snapshot, edited in `apps/platform-web`, served by `apps/platform-server` (`GET /public/site/:locale`). The only text allowed in `src` is in `src/content/fixture.*.json`, which is a marked sample for dev and CI.
2. **Bad snapshots fail the build** (LAC8). `parseSnapshot` in `src/lib/content.ts` throws on schema errors. Unknown block types are skipped with a warning, never a crash.
3. A block component receives exactly its validated data type. Add a block: schema in `src/lib/snapshot.ts`, component and registry entry in `src/blocks`, fixture sample, test.
4. `src/lib/snapshot.ts` is a temporary local copy of the schema. Move it to `@avuny/contracts` (a `site` module) when platform-server serves it.
5. Never import `@avuny/db` or call tenant APIs. Public, no auth, no cookies.
6. Arabic is first class (`dir="rtl"`, logical CSS properties like `ms-*`, `ps-*`, `text-start`). Honor `prefers-reduced-motion` for every animation. No `next/font/google` (network at build); self-host fonts.
7. Static export only (`output: "export"`): no server actions, no runtime image optimizer, no route handlers that need a server.

## Commands
```bash
pnpm --filter @avuny/landing dev        # http://localhost:3010, builds from the sample fixture
PLATFORM_API_URL=http://localhost:8788 pnpm --filter @avuny/landing build
pnpm --filter @avuny/landing typecheck
pnpm --filter @avuny/landing test
```

## Deployment
Not deployed, not in `.github/workflows/deploy.yml`. Recommended later: Workers static assets from `out/`, rebuilt by a publish webhook (LANDING-SPEC 2.2). Needs owner decisions on domain and Cloudflare resources.
