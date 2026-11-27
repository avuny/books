# Avuny Books

Multi-tenant accounting and inventory app. pnpm + Turborepo monorepo.

## Stack

- **Server** (`apps/server`, `@avuny/books-server`): Hono + `@hono/zod-openapi` REST API. Runs on Cloudflare Workers, or on Node.
- **Web** (`apps/web`, `@avuny/books-web`): React 19 SPA on Vite, TanStack Router and Query, Tailwind 4, Orval-generated API client. English and Arabic.
- **Packages** (`packages/*`): `contracts` (Zod schemas, types and locales shared by server and web), `db` (Drizzle ORM + PostgreSQL, imported only by the server), `ui` (shadcn-style components), `hono`, `zod`, `i18n`, `logger`, `utils`, and shared ESLint and TypeScript configs.

See [AGENTS.md](./AGENTS.md) for architecture rules and conventions, and [docs/](./docs) for feature, testing and frontend notes.

## Requirements

- Node >= 20.19
- pnpm (version pinned in `package.json`)
- Docker, for the integration and e2e test database

## Getting started

```bash
pnpm install
pnpm codegen        # routes, barrels and schema
pnpm dev            # runs server and web through turbo
```

The web app needs `VITE_API_URL` set to the API base URL.

## Common commands

| Command | What it does |
| --- | --- |
| `pnpm build` | Build everything |
| `pnpm lint` / `pnpm typecheck` / `pnpm format` | Lint, type-check, format |
| `pnpm openapi:generate` then `pnpm api:generate` | Regenerate the OpenAPI spec, then the web API client |
| `pnpm intl:generate` | Regenerate server locale files |
| `pnpm seed` | Seed the database |
| `pnpm test:int` | Server integration tests (starts the test database) |
| `pnpm test:e2e` | Playwright e2e tests (starts the test database) |
| `pnpm test:db:down` | Stop the test database |

## Adding UI components

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

Components land in `packages/ui/src/components`. Import them with:

```tsx
import { Button } from "@workspace/ui/components/button";
```

## Deployment

Deploys run through the GitHub workflow in `.github/workflows/deploy.yml`. Migrations and the seed run automatically, and the deploy stops if the production database secret is missing. Manual deploys:

```bash
pnpm turbo run deploy --filter=@avuny/books-server
pnpm turbo run deploy --filter=@avuny/books-web
```

The web app sends security headers from `apps/web/public/_headers`.

## Releases

`pnpm release` runs `scripts/release.sh`. Changes are listed in [CHANGELOG.md](./CHANGELOG.md).
