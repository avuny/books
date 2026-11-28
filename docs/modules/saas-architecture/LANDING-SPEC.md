# Marketing Landing Site - Implementation Specification

| | |
|---|---|
| Version | 1.0 · 2026-11-27 |
| Status | proposed (decisions Q25 to Q30 in PROGRESS.md; defaults proposed) |
| Owner | Khalid (avuny) |
| Depends on | `PLATFORM-ADMIN-SPEC.md` (content and plans are edited there), `SPEC.md` (plans and entitlements), `apps/platform-server`, `packages/contracts` |

## 0. Reading order for agents
AGENTS.md, then `SPEC.md` sections 1 and 2, `PLATFORM-ADMIN-SPEC.md` section 4, then this file.

## 1. Goals and non-goals

### 1.1 Goals
1. A public marketing site, built with **Next.js**, with a modern, animated SaaS design that reflects the Avuny business app (inventory, purchasing, accounting; warehouses, batches, costing).
2. **No marketing text, image or price is hard-coded.** Texts, images and the plan and feature matrix come from the admin panel. The site renders a **published snapshot**.
3. The plan and feature matrix on the site is the real catalog: it is derived from published plan versions, so the page can never advertise something the plans do not contain (SPEC R7, review item 17).
4. English and Arabic (RTL) from day one.
5. Fast and cheap: it runs on Cloudflare with no per-request server work for normal visits.
6. Visitors go from the site into the app: sign up, log in, pick a plan.

### 1.2 Non-goals (v1)
- A blog or CMS for long articles (a later phase can reuse the same content model).
- A/B testing, analytics dashboards, cookie consent tooling beyond what law requires (analytics choice is Q30).
- Customer testimonials, logos or numbers that do not exist. The content model supports them, the site shows none until real ones are entered. No invented social proof.

## 2. Architecture

### 2.1 Pieces
```
 Admin web (apps/platform-web)      edits drafts: site content, media, plan marketing fields
        |
 Platform API (apps/platform-server)
        |  publish                       public read-only endpoints (cached)
        v                                  GET /public/site/:locale
 site_content_versions (draft, published)  GET /public/plans
        |  published snapshot (JSON, versioned, includes plan matrix)
        v
 apps/landing (Next.js)   reads the snapshot at build time, renders pages
        ^                          |
        |  publish triggers a rebuild (deploy hook), preview builds for drafts
```
New app: `apps/landing` (`@avuny/landing`). It never imports `@avuny/db`. It reads only the public snapshot over HTTP and shares `@avuny/contracts` types.

### 2.2 Hosting and rendering: recommendation
Cloudflare Workers is already the platform (API and web). Options:

| | A. Static export (`output: "export"`) served as Workers static assets, rebuilt on publish (recommended) | B. Next.js on Workers through the OpenNext Cloudflare adapter, with ISR | C. Cloudflare Pages with Next on Pages |
|---|---|---|---|
| Speed and cost | Pure static files at the edge. Fastest, near zero cost, nothing to fail at runtime. | Dynamic runtime, needs a cache store (R2 or KV) for ISR, more moving parts. | Similar to B, adapter is in maintenance mode in favor of OpenNext. |
| Matches existing setup | Same pattern as `apps/web` (assets on a Worker, `wrangler.jsonc` with `assets`). | New runtime and bindings. | Different product (Pages). |
| Content freshness | Publish triggers a rebuild, live in about 1 to 3 minutes. Fine for marketing. | Revalidate on publish, seconds. | Same as B. |
| Next.js features lost | No server actions, no ISR, no built-in image optimizer (use pre-sized images from R2 or Cloudflare Images). None needed for a marketing site. | Everything. | Most. |
| Forms (contact, waitlist) | Post to the platform API (public endpoint with rate limit). | Server actions possible. | Same. |
| Preview of drafts | A separate preview build from the draft snapshot on a preview hostname. | Preview mode with a cookie. | Preview deployments. |
| Risk | Rebuild pipeline must be reliable and secured. | Adapter and version churn, cold starts. | Adapter churn. |

Recommendation: **A**. The content changes rarely, the page must be fast and cheap, and Workers static assets is exactly what `apps/web` already uses. Choose B later only if you need per-request personalization (for example prices by visitor country) that client-side code cannot do. Visitor currency and language are handled in the browser from the snapshot, which carries every currency and locale.

The rebuild trigger: publish in the admin calls the platform API, which dispatches a GitHub Actions workflow (`workflow_dispatch`) that builds and deploys `apps/landing`. This needs a GitHub token stored as a platform secret (decision Q26) and a new workflow that is not added until you approve (nothing is deployed in the scaffold).

### 2.3 Domains
Landing on the root domain (`<domain>`), tenant app on `app.<domain>`, admin on `admin.<domain>`. Until a domain exists, workers.dev subdomains are used (Q23 already decided).

## 3. Content model (edited in the admin)

### 3.1 Principles
- Content is **typed blocks**, not free HTML. The design stays consistent and safe; the admin edits fields, not markup.
- Every text field is localized (`en`, `ar`). A snapshot with a missing locale for a required field fails publish validation.
- Pricing and the matrix are **never typed**. They are rendered from published plan versions plus marketing fields on the plan (below). One source of truth.

### 3.2 Tables (new)
| Table | Purpose | Key columns |
|---|---|---|
| `site_pages` | Pages of the site (home, pricing, features, contact, legal) | `key` unique, `slug` per locale, `status`, `seo` jsonb (title, description, og image per locale) |
| `site_blocks` | Ordered blocks of a page | `page_id`, `position`, `type`, `data` jsonb (validated by the block type's schema), `is_visible` |
| `site_media` | Media library | `id`, `r2_key`, `mime`, `width`, `height`, `bytes`, `alt` jsonb (en, ar), `created_by` |
| `site_settings` | Global texts | nav items, footer, social links, contact email, legal links, brand name, default CTA targets |
| `site_content_versions` | Versions | `id`, `status` (draft, published, archived), `snapshot` jsonb (full resolved content), `published_at`, `published_by`, `reason`, `content_hash` |
| `plan_marketing` | Marketing fields per plan version | `plan_version_id`, `tagline` (en, ar), `badge` (en, ar), `is_highlighted`, `cta_label` (en, ar), `cta_target`, `bullets` (ordered list of catalog keys to feature) |

Feature rows shown in the matrix use the **catalog display names** from `catalog_modules`, `catalog_features`, `catalog_limits` (PLATFORM-ADMIN-SPEC 4.1), already localized. The admin chooses which rows appear in the public matrix and in which group and order (`site_matrix_rows`: `catalog_key`, `group`, `position`, `is_public`).

### 3.3 Block types (first set)
| Type | Fields |
|---|---|
| `hero` | headline, subheadline, primary CTA, secondary CTA, hero media (image or product screenshot), badges |
| `logo_strip` | media items (hidden until real logos exist) |
| `feature_grid` | items: icon key, title, text |
| `module_showcase` | tabs per product module: title, text, media, bullet list. Links to catalog module keys so it can show a "Pro" badge from the plan data |
| `steps` | numbered how-it-works items |
| `stats` | number, label (only real, admin-entered, dated numbers) |
| `pricing` | no content fields except heading and notes; plans and matrix come from published plan data. Interval toggle and currency switch from the snapshot |
| `comparison_table` | full feature matrix by module group |
| `faq` | question and answer pairs |
| `testimonial` | quote, name, role, media (hidden until real) |
| `cta_banner` | headline, text, CTA |
| `rich_text` | restricted formatting (bold, links, lists) for legal pages |

Media rules: only uploaded through the admin (stored in R2, served from a public media hostname); max size, allowed types (png, jpg, webp, avif, svg sanitized); alt text required in both languages before publish; responsive sizes generated at upload (so the static site needs no runtime image optimizer).

## 4. Publish flow and public API

### 4.1 Publish
1. Admin edits the draft version (blocks, settings, media, plan marketing, matrix rows).
2. Preview: a draft preview build on a preview hostname (or an embedded preview in the admin using the same React components from a shared package, decision Q27).
3. Validation before publish (LR1 to LR6):
   - **LR1** every required text exists in every enabled locale;
   - **LR2** every media has alt text in every locale and exists;
   - **LR3** every link target is valid (internal page exists, external has https);
   - **LR4** the matrix rows reference existing public catalog keys and every plan shown has a published version and at least one active price;
   - **LR5** the pricing block cannot contain a hand-typed price; prices come from plan prices only;
   - **LR6** snapshot size under a limit and the JSON schema validates.
4. Publish writes an immutable snapshot (`content_hash`), archives the previous one, audits who and why, and triggers the rebuild. Rollback publishes an earlier snapshot as a new one.
5. If the plan catalog changes (a plan version is published, PLATFORM-ADMIN-SPEC 4.2), the site snapshot is **recomputed** and a rebuild is triggered, so the pricing section never lags the real catalog (LR7).

### 4.2 Public read API (in `apps/platform-server`, no auth)
| Route | Purpose |
|---|---|
| `GET /public/site/:locale` | The published snapshot for a locale (content, settings, plan cards, matrix, media URLs). ETag and cache headers. |
| `GET /public/plans` | Published plans, prices per currency and interval, matrix. Same data as inside the snapshot. |
| `GET /public/site/version` | Current content hash, so the build can skip when unchanged. |
| `POST /public/contact` | Optional contact or waitlist form, rate limited, spam protected (Q30). |

Rules: read-only, no tenant data, nothing from drafts, rate limited at the edge, CORS allows the landing hostname. Responses carry only published content.

## 5. The Next.js app

### 5.1 Stack (follows the repo)
Next.js (App Router) with `output: "export"`, React 19, Tailwind CSS 4, shared `@workspace/ui` primitives where they fit, TypeScript strict, `@avuny/contracts` types, `@avuny/i18n` for locale and RTL helpers. Animation with the `motion` library (Framer Motion successor) and CSS scroll-driven effects, always honoring `prefers-reduced-motion`. No heavy video backgrounds; images lazy loaded and pre-sized.

### 5.2 Structure
```
apps/landing/
  AGENTS.md  CLAUDE.md  next.config.ts  package.json  tsconfig.json  eslint.config.mjs
  src/app/[locale]/layout.tsx  page.tsx  pricing/page.tsx  ...   one route set per locale
  src/blocks/            one React component per block type + registry (type -> component)
  src/lib/content.ts     loads the snapshot: build-time fetch from PLATFORM_API_URL, local fixture when unset
  src/lib/seo.ts         metadata, sitemap, robots, hreflang, JSON-LD
  src/content/fixture.*.json   a safe sample snapshot used in dev and CI (clearly marked sample)
  src/components/        header, footer, locale switcher, animated primitives
```
Rules: a block's React component receives exactly the validated data type from `@avuny/contracts`; unknown block types are skipped with a build warning, not a crash; the build fails if the snapshot fails schema validation, so a bad publish never ships.

### 5.3 Design direction (a brief the designer or agent follows; the owner confirms in Q28)
- Reflects the product: warehouse, stock movement, purchase to payment flow, costing and accounting. Real product screenshots in framed device mockups rather than stock illustrations.
- Modern SaaS look: strong typographic hierarchy, generous spacing, restrained color with one accent, subtle gradients and glass cards, dark and light themes, animated gradient hero, scroll-reveal sections, animated module tabs, a pricing toggle with smooth transitions, count-up stats (only real numbers), animated flow diagram "order to cash to ledger".
- Arabic is a first-class layout: RTL mirrored, Arabic-appropriate typeface and line height, not a translation bolted on.
- Performance and accessibility targets: Lighthouse 95 or more on performance and 100 on accessibility for the home page, contrast AA, keyboard navigable, no layout shift, animations off for reduced motion.
- Brand inputs needed from the owner: name and logo, colors, tone, screenshots of the app (can be captured from the staging app), contact details, legal entity and policies (privacy, terms) text.

### 5.4 SEO and legal
Per-locale metadata, `hreflang`, sitemap, robots, Open Graph images from admin media, structured data (organization, product, pricing offers from plan data). Legal pages (privacy, terms) as `rich_text` pages, content supplied by the owner. Cookie or analytics consent only if analytics are added (Q30).

## 6. Permissions
Platform registry additions (PLATFORM-ADMIN-SPEC section 8): `platform-site` (read, update, publish, rollback), `platform-media` (read, create, delete), `platform-plan-marketing` (read, update). Default grants: `super_admin` all; `catalog_manager` all three; `viewer` read.

## 7. Acceptance criteria
- **LAC1** The home page renders entirely from a snapshot; changing the snapshot changes the page; no marketing text, image URL or price is in the app source (grep test over `src` excluding the fixture).
- **LAC2** The pricing section and comparison table equal the published plan data: a test publishes a plan change and the rebuilt snapshot differs accordingly (LR7).
- **LAC3** Publish validation rejects each of LR1 to LR6 with a specific error.
- **LAC4** en and ar routes exist with correct `lang`, `dir`, hreflang, and mirrored layout; screenshots of hero, pricing and FAQ in both.
- **LAC5** Reduced motion disables all non-essential animation (test with the media query emulated).
- **LAC6** Lighthouse thresholds from 5.3 pass in CI on the fixture build.
- **LAC7** The public API serves only published content and returns no tenant, draft or secret data; ETag works; rate limit active.
- **LAC8** A bad snapshot fails the landing build and does not deploy.
- **LAC9** Rollback of a published snapshot restores the previous site after rebuild.

## 8. Implementation tasks
Tracked in PROGRESS.md: platform admin phase A8 (content editor, media, publish) and landing phases L1 to L5. The Next.js scaffold exists first (L1) so design work can start against the fixture while the admin side is built.

## 9. Repository checks before implementation
1. `apps/web` build, `wrangler.jsonc` assets setup, to mirror for the landing Worker.
2. `packages/ui` components usable outside the Vite app (Tailwind 4 config, RTL support).
3. `@avuny/i18n` locale helpers usable in Next.
4. Cloudflare: R2 availability for media, a way to dispatch the rebuild (GitHub token scope), custom domain plan.
5. Screenshots of the current app for the product mockups.

## 10. Decisions to preserve
- The landing site is a static render of an immutable published snapshot. Nothing is hard-coded.
- The pricing and matrix always come from published plan versions; marketing text never carries prices.
- Content is typed blocks, localized, validated at publish.
- No fabricated testimonials, logos or statistics.
- The landing app has no database access and no secrets.
