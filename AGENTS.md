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
4. **Package-Specific AGENTS.md**:
   - Check subpackage `AGENTS.md` files (e.g. in `apps/web/`, `packages/contracts/`, `packages/db/`, `packages/hono/`) for localized package constraints.

---

## Documentation Reference (`/docs`)

Detailed architectural standards and design patterns are documented in `/docs`. Always consult these documents before implementing features:

| Document                                                                                  | When to Consult                     | Summary                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [docs/FORMS.md](file:///Users/khaled/Dev/projects-2026-october/books/docs/FORMS.md)       | Building or modifying web forms     | Enforces 3-layer architecture: Form (`<name>-form.tsx`) → Container (`<name>.tsx`) → Route (`routes/**`). Use `@workspace/ui/blocks/form` primitives and contract schemas.       |
| [docs/COPY.md](file:///Users/khaled/Dev/projects-2026-october/books/docs/COPY.md)         | Adding or changing user-facing text | **Zero hardcoded strings**. Text lives in `@avuny/contracts/<module>/locales/{en,ar}.json`. Containers read keys via `t()` and pass a `copy` object down into forms.             |
| [docs/FRONTEND.md](file:///Users/khaled/Dev/projects-2026-october/books/docs/FRONTEND.md) | Writing UI components or styling    | Small, testable components with dependency injection. Strict use of semantic theme tokens (`bg-background`, `text-foreground`, `border-border`) supporting light and dark modes. |
| [docs/GIT.md](file:///Users/khaled/Dev/projects-2026-october/books/docs/GIT.md)           | Creating commit messages            | Conventional Commits rules, subject line conventions, and body bullet formatting.                                                                                                |
