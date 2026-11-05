# AGENTS.md

Repository guide for AI agents working in this monorepo.

## Monorepo Architecture

- **Package Manager**: `pnpm` (workspaces)
- **Task Runner**: `turbo`
- **Backend**: Cloudflare Workers / Node via Hono + `@hono/zod-openapi` (`apps/server`)
- **Frontend**: React 19 SPA with Vite 8, TanStack Router & Query, Tailwind CSS 4 (`apps/web`)
- **Database**: Drizzle ORM with PostgreSQL (`packages/db`)
- **API Contracts**: End-to-end type safety via Zod schemas (`packages/contracts`) and Orval generated client

---

## Directory Map

### Applications (`apps/`)

| Path          | Package Name          | Description & Key Responsibilities                                                                                                          |
| ------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/server` | `@avuny/books-server` | Hono REST/OpenAPI API. Mounts feature modules under `src/api/modules/*`. Deploys to Cloudflare Workers or runs via Node.                    |
| `apps/web`    | `@avuny/books-web`    | Client SPA. Uses TanStack file-based routing (`src/routes`), feature modules (`src/features/*`), and Orval-generated queries (`src/api/*`). |

### Shared Packages (`packages/`)

| Path                         | Package Name               | Rules & Responsibilities                                                                                                                             |
| ---------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts`         | `@avuny/contracts`         | **Single source of truth** for API schemas, types, and domain locale files (`src/<module>/locales/{en,ar}.json`). Runtime-agnostic (no Node/DOM/DB). |
| `packages/db`                | `@avuny/db`                | Drizzle ORM schemas, migrations (`drizzle-kit`), and client. **Only `@avuny/books-server` may import this package.**                                 |
| `packages/ui`                | `@workspace/ui`            | Shared UI components (shadcn/ui style, Tailwind 4). Form building blocks live in `@workspace/ui/blocks/form`.                                        |
| `packages/hono`              | `@avuny/hono`              | Server utilities: `createOpenAPIRouter`, `handleResult`, request language resolution via `node:async_hooks`.                                         |
| `packages/i18n`              | `@avuny/i18n`              | Shared locale types, default locale, RTL/LTR detection, and `resolveLocale`.                                                                         |
| `packages/logger`            | `@avuny/logger`            | Structured Pino logger for server and background tasks.                                                                                              |
| `packages/utils`             | `@avuny/utils`             | Pure runtime-agnostic utility functions and the `Result<T, E>` pattern (`ok`, `fail`).                                                               |
| `packages/zod`               | `@avuny/zod`               | Central Zod instance and validation helpers. **Always import `z` from `@avuny/zod`, never directly from `zod`.**                                     |
| `packages/eslint-config`     | `@avuny/eslint-config`     | Monorepo ESLint configurations.                                                                                                                      |
| `packages/typescript-config` | `@avuny/typescript-config` | Shared TypeScript tsconfig presets.                                                                                                                  |

---

## Essential Commands

Always run commands from the repository root using `pnpm`:

```bash
# Development & Build
pnpm dev              # Start all dev servers (API + Web)
pnpm build            # Build all packages and apps via Turbo
pnpm typecheck        # Run type checking across the entire monorepo
pnpm lint             # Run ESLint across all projects
pnpm format           # Format with Prettier

# API & Schema Generation Pipeline
pnpm intl:generate    # Re-generate server i18next registration & typing from locales/
pnpm openapi:generate # Generate OpenAPI spec from backend route definitions
pnpm api:generate     # Re-generate Orval TypeScript client & React Query hooks in apps/web

# Adding shadcn UI components to packages/ui
pnpm dlx shadcn@latest add <component-name> -c apps/web
```

---

## Core Engineering Rules

1. **Schema & Contract First**:
   - Define all request bodies, query params, and response contracts in `packages/contracts/<module>`.
   - Infer TypeScript types using `z.infer<typeof ...>`. Never duplicate schema shapes manually in server or web.
   - When modifying routes/contracts, run `pnpm api:generate` to regenerate client hooks.
2. **Strict Package Boundaries**:
   - Never import `@avuny/db` into client apps or shared packages; only the server may access it.
   - Never import `zod` directly. Always use `import { z } from "@avuny/zod"`.
   - `packages/contracts` and `packages/utils` must remain strictly runtime-agnostic (no Node, DOM, or DB dependencies).
3. **Domain Error & Result Handling**:
   - Backend services return `Result<T, E>` (`ok(data)` or `fail(code, message)`) from `@avuny/utils`.
   - Server endpoints map `Result` objects using `handleResult(c, result)` from `@avuny/hono`.
4. **Package-Specific AGENTS.md & Backend Architecture**:
   - Check subpackage `AGENTS.md` files (e.g. in `apps/server/`, `apps/web/`, `packages/contracts/`, `packages/db/`, `packages/hono/`) for localized package constraints.
   - For backend modules in `apps/server`, agents must strictly follow the canonical module pattern demonstrated in `apps/server/src/api/modules/organization-invitation` and described in `apps/server/AGENTS.md`:
     - Explicit `deps.ts` for singleton DI wiring.
     - Closure factory routes accepting `RouteDeps` (`module-routes.types.ts`).
     - Port interfaces in `<module>.types.ts` (PermissionChecker, ActivityLog, Limits, etc.).
     - Comprehensive `<module>.error-map.ts` and `SPEC.md`.
     - Route-level tests in `__tests__/`.
5. **Execution Tracking & Sequential Work via TODO.md**:
   - When executing multi-step or multi-module refactorings or implementations, AI agents must maintain a `TODO.md` in the working package (e.g. `apps/server/TODO.md`).
   - Group tasks by module into `Todo`, `InProgress`, and `Done` sections with exact dates and timestamps (`YYYY-MM-DD HH:mm`).
   - Always work sequentially: finish one module completely (all files, tests, typecheck) before moving to the next, keeping `TODO.md` continuously synced.

---

## Documentation Reference (`/docs`)

Detailed architectural standards and design patterns are documented in `/docs`. Always consult these documents before implementing features:

| Document                                                                                  | When to Consult                     | Summary                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [docs/FORMS.md](file:///Users/khaled/Dev/projects-2026-october/books/docs/FORMS.md)       | Building or modifying web forms     | Enforces 3-layer architecture: Form (`<name>-form.tsx`) → Container (`<name>.tsx`) → Route (`routes/**`). Use `@workspace/ui/blocks/form` primitives and contract schemas.       |
| [docs/COPY.md](file:///Users/khaled/Dev/projects-2026-october/books/docs/COPY.md)         | Adding or changing user-facing text | **Zero hardcoded strings**. Text lives in `@avuny/contracts/<module>/locales/{en,ar}.json`. Containers read keys via `t()` and pass a `copy` object down into forms.             |
| [docs/FRONTEND.md](file:///Users/khaled/Dev/projects-2026-october/books/docs/FRONTEND.md) | Writing UI components or styling    | Small, testable components with dependency injection. Strict use of semantic theme tokens (`bg-background`, `text-foreground`, `border-border`) supporting light and dark modes. |
| [docs/GIT.md](file:///Users/khaled/Dev/projects-2026-october/books/docs/GIT.md)           | Creating commit messages            | Conventional Commits rules, subject line conventions, and body bullet formatting.                                                                                                |
# AGENTS.md — how to build modules in this monorepo

Audience: AI coding agents (Claude Code, Codex, Cursor, Copilot, …).
Read this file fully, then open the **skill** that matches your task. Skills hold copy-paste templates, **rules** are short must/never lists, the **workflow** gives the order of work.

> ⚠ marks a path or command that was *inferred* from import paths, not read from the repo. Verify it once, fix it here, delete the ⚠.

## 1. Repo map

| Area | Path | What lives there |
|---|---|---|
| Contracts (shared) | `packages/contracts/src/<module>/` ⚠ | constants, error codes, Zod schemas/DTOs, `locales/{en,ar}.json`. Imported by API **and** web as `@avuny/contracts` |
| API modules | `apps/api/src/modules/<module>/` ⚠ | `<module>.service.ts`, `<module>.errors.ts`, `hono-routes/` (one file per endpoint) |
| Web features | `apps/web/src/features/<name>-module/` | all UI for one domain: api hooks, forms, list, details, lib |
| Web routes | `apps/web/src/routes/` | TanStack Router **file routes**; thin wrappers around features |
| UI kit | `@workspace/ui` | `components/*` (shadcn-style), `blocks/form`, `blocks/data-table`, `lib/api-error`, `providers/*` |
| Generated API client | `@/api` (inside `apps/web`) | generated from the API's OpenAPI; hook names come from each route's `operationId` |

Stack: TypeScript (ESM, `.js` extensions in server/contract imports), Zod via `@avuny/zod`, Hono + `@hono/zod-openapi`, Drizzle + Postgres, React, TanStack Router + Query + Table, react-hook-form, i18next (`en` + `ar`, RTL), Tailwind with semantic tokens, Vitest.

## 2. The one idea: contracts first

```
@avuny/contracts  ──►  API (service + hono-routes)  ──►  generated client (@/api)  ──►  web feature  ──►  web route
 schemas, codes,        validates with the same          hooks named by operationId      pure views +        thin: params,
 locales, rbac          schemas; returns Result          (useListProjects, …)            containers          navigate
```

Never define a request/response shape twice. If the web needs a type, it comes from `@avuny/contracts` (re-exported by the feature's `types.ts`).

## 3. Task → skill

| You are asked to… | Open |
|---|---|
| Add a domain/module, a schema, an error code, a success message | `.agents/skills/contracts-module/SKILL.md` |
| Add or change an HTTP endpoint | `.agents/skills/api-hono-routes/SKILL.md` |
| Add a screen/list/form/details UI for a domain | `.agents/skills/web-feature-module/SKILL.md` |
| Add a page, layout, redirect, search param, public page | `.agents/skills/web-routes/SKILL.md` |
| Add or change any translated string (contracts or web) | `.agents/skills/locales/SKILL.md` |
| Add a permission, resource, system role, hide a button by permission | `.agents/skills/rbac-permissions/SKILL.md` |
| Build a whole new module end to end | `.agents/workflows/new-module.md` (it links the skills in order) |

Rules (read the ones touching your task, they are short): `.agents/rules/*.md`.

## 4. Non-negotiables (the 12 that cause most review comments)

1. **Contracts first.** Schema/codes/locales exist before API or UI code.
2. **Import `z` from `@avuny/zod`**, never from `zod`.
3. **One endpoint = one file** `<verb>-<resource>.route.ts`, composed in the module's `hono-routes/index.ts`.
4. **`operationId` is camelCase and unique**; it becomes the web hook name. Renaming it breaks the web.
5. **Every domain error code** appears in (a) `errors.ts`, (b) the route's `responses` under a literal status key, (c) the route's `errorMap`, (d) **both** `en.json` and `ar.json`.
6. **Web feature = pure views + containers.** Views get already-translated `copy`; only containers call `useTranslation`, API hooks, or navigation.
7. **Only `<name>-api.ts` knows the generated client.** Everything else consumes normalized values.
8. **Features never navigate.** They call callbacks (`onSuccess`, `onBack`, `onViewX`); the route decides where to go.
9. **Route files are thin**: read params, `useNavigate`, render one feature component.
10. **UI hiding is cosmetic; the server enforces permissions.** Never rely on `hasPermission` in the web alone.
11. **RTL-safe + semantic tokens**: `ps-/pe-/ms-/me-/start/end`, `rtl:rotate-180` on directional icons; `text-foreground`, `bg-card`, `border-border` — no hard-coded colors, no `left/right`.
12. **No hard-coded user-facing strings** — not even "coming soon" placeholders (existing `users.tsx` does this; don't copy it).

## 5. Commands ⚠ (fill in once)

| Purpose | Command |
|---|---|
| Install | `<pnpm install>` |
| Typecheck all | `<pnpm typecheck>` |
| Lint | `<pnpm lint>` |
| Unit tests (Vitest) | `<pnpm test>` / single file: `<pnpm vitest run path>` |
| Regenerate API client after changing a route | `<pnpm … api:generate>` |
| Regenerate TanStack route tree | runs with the web dev server, or `<tsr generate>` |
| DB migrate / seed system roles | `<pnpm db:migrate>` / `<pnpm seed:roles>` (system roles are synced by `seed:roles`) |

## 6. Definition of done (every PR)

- [ ] Contracts: schemas, codes, `index.ts` export, `en.json` **and** `ar.json` updated (same keys).
- [ ] API: one route file per endpoint, registered in `hono-routes/index.ts`; permission check + plan limits in the service.
- [ ] Client regenerated; web hooks compile.
- [ ] Web: views are pure; containers build `copy`; list/forms/details export through folder `index.ts` barrels.
- [ ] Route files created under the right path; `createFileRoute("<path>")` string matches the file location.
- [ ] Tests for pure logic (`lib/*.test.ts`) and normalizers (`<name>-api.test.ts`).
- [ ] Typecheck, lint, tests pass. Checked in LTR **and** RTL (Arabic).

## 7. When unsure

Prefer the pattern in the skill templates over inventing. If a template does not cover your case, extend it minimally and keep the same layering. Do not introduce new libraries, new folder layouts, or route-level permission middleware without being asked (that decision is still open: today permissions are checked in the service).
