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

# Tests (see docs/TESTING.md; the integration/e2e suites need the test database)
docker compose -f apps/server/docker-compose.test.yml up -d --wait
pnpm --filter @avuny/books-server test        # unit tests (no database)
pnpm --filter @avuny/books-server test:int    # route integration tests (real app + real test DB)
pnpm --filter @avuny/books-web e2e            # browser e2e (Playwright)

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
6. **Stock Movement Conventions & Future Stock-Affecting Modules**:
   - Every module or transaction that affects inventory quantities must integrate with the centralized Stock Movement ledger (`stock_movements` / `stock_movement_lines`).
   - **Reusable Component**: All views displaying stock movements (General page, Item details movements tab, Warehouse history) MUST reuse the canonical component from `apps/web/src/features/stock-movement-module`. Never duplicate table components, queries, or conversion logic.
   - **Virtual Warehouse Rules**: Virtual warehouses (System, Adjustment, Transit, Supplier, Customer) are internal implementation details. NEVER expose virtual warehouse names or internal location details to users in tables, badges, or filters.
   - **Direction & Warehouse Display**: Movements involving a virtual counterparty display only the physical warehouse/location with direction `IN` or `OUT`.
   - **Base Unit Storage**: All stock ledger quantities and balances are stored as positive numeric strings in the item's base unit.
   - **Running Balance**: Computed post-movement, strictly partitioned per `(item_id, physical_location_id)` pair, and evaluated chronologically. Outer filters (date ranges, pagination) must never alter historical balances.
   - **Display Unit Conversion**: When scoped to a single item, allow unit conversion using the item's unit collection. Convert running balances and quantities dynamically for display without altering stored data.
   - **Protocol for Future Stock-Affecting Modules** (Inventory Transfer, Sales, Purchases, Returns, Assembly):
     1. Define the movement type in `STOCK_MOVEMENT_TYPES` (`packages/contracts/src/stock-movement/constants.ts`).
     2. Define stock impact and direction (`IN`, `OUT`, or `TRANSFER`).
     3. Define physical or virtual warehouse involvement.
     4. Define how its Warehouse - Location information should appear.
     5. Integrate with the reusable Stock Movement component.
     6. Persist quantities strictly in the item's base unit.
     7. Update centralized documentation (`packages/contracts/src/stock-movement/SPEC.md` and `AGENTS.md`).
     *(Note: Inventory Transfer is a future feature. Do not introduce From/To columns until transfer support is formally implemented).*

---

## Documentation Reference (`/docs`)

Detailed architectural standards and design patterns are documented in `/docs`. Always consult these documents before implementing features:

| Document                                                                                  | When to Consult                     | Summary                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [docs/FORMS.md](file:///Users/khaled/Dev/projects-2026-october/books/docs/FORMS.md)       | Building or modifying web forms     | Enforces 3-layer architecture: Form (`<name>-form.tsx`) → Container (`<name>.tsx`) → Route (`routes/**`). Use `@workspace/ui/blocks/form` primitives and contract schemas.       |
| [docs/COPY.md](file:///Users/khaled/Dev/projects-2026-october/books/docs/COPY.md)         | Adding or changing user-facing text | **Zero hardcoded strings**. Text lives in `@avuny/contracts/<module>/locales/{en,ar}.json`. Containers read keys via `t()` and pass a `copy` object down into forms.             |
| [docs/FRONTEND.md](file:///Users/khaled/Dev/projects-2026-october/books/docs/FRONTEND.md) | Writing UI components or styling    | Small, testable components with dependency injection. Strict use of semantic theme tokens (`bg-background`, `text-foreground`, `border-border`) supporting light and dark modes. |
| [docs/TESTING.md](docs/TESTING.md) | Writing or running tests | Unit vs route-integration vs web-e2e: what each layer is for, the dedicated test database (same Neon HTTP driver as production, dropped and rebuilt per run), per-test isolation by fresh tenants, captured OTPs, CI. |
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
| Write or extend integration tests for a module's HTTP routes (real DB, real user flows) | `.agents/skills/api-integration-tests/SKILL.md` |
| Write or extend browser end-to-end tests for the web app | `.agents/skills/web-e2e-tests/SKILL.md` |
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
13. **Locale interpolation uses single braces `{variable}`**, never double braces `{{variable}}`. All `en.json` and `ar.json` files in this repo must use `{name}`, `{count}`, `{from}`, etc. Double braces are rendered literally and will not be substituted at runtime.

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
- [ ] Backend module: `<module>.routes.int.test.ts` covers every route and every reachable error code (`skills/api-integration-tests`). New web journey: an e2e spec (`skills/web-e2e-tests`).
- [ ] Typecheck, lint, tests pass. Checked in LTR **and** RTL (Arabic).

## 7. When unsure

Prefer the pattern in the skill templates over inventing. If a template does not cover your case, extend it minimally and keep the same layering. Do not introduce new libraries, new folder layouts, or route-level permission middleware without being asked (that decision is still open: today permissions are checked in the service).




# Task: Establish Synchronized, Contract-First Module Specifications

## Objective

Improve the project documentation by introducing or enhancing a `SPEC.md` in every module in both the contracts and server packages.

The goal is to establish a **single, reliable source of truth for each module**, allowing frontend and backend agents to work independently while remaining completely aligned.

A frontend agent should be able to read the module's contracts directory, understand the business requirements, know exactly what UI to build, understand every user interaction, and identify precisely which API endpoints to consume without inspecting or reverse-engineering the backend implementation.

Backend agents should use the same specification to implement the required behavior and maintain consistency with the frontend.

## 1. Contracts Specification — Canonical Module Specification

Location:

`packages/contracts/src/<module>/SPEC.md`

This is the primary specification and the source of truth for the module's business behavior, frontend requirements, and public API contract.

It should document:

### A. Module Overview
- Purpose and responsibilities.
- Main features and supported operations.
- Business workflows and user journeys.
- Module boundaries and ownership.
- Dependencies on other modules.

### B. Frontend Requirements
Describe everything the frontend needs to implement:

- Pages, screens, tabs, sections, and navigation.
- Tables, columns, filters, sorting, and pagination.
- Create and update forms, dialogs, drawers, and confirmation dialogs.
- Form fields, input types, defaults, required status, validation, and conditional visibility.
- Available actions and their expected behavior.
- Select inputs and their data sources, including dependencies between fields.
- Search, filtering, bulk operations, and other interactions where applicable.
- Loading, empty, success, error, validation, and permission-denied states.
- Responsive behavior, localization, English/Arabic translations, and RTL requirements.

Describe not only what components exist, but also exactly how they should behave.

### C. Business Rules and Domain Behavior
Document the actual business rules independently of the UI:

- Validation and domain constraints.
- Relationships between entities.
- Allowed and forbidden operations.
- Dependencies between fields and entities.
- Lifecycle statuses and permitted state transitions.
- Business calculations and default values.
- Important edge cases and exceptional scenarios.
- Rules that must be enforced by the backend, even when the frontend performs preliminary validation.

### D. API Contract and Endpoint Documentation

Document every endpoint required by the module.

For each endpoint specify:

- Stable operation/requirement ID.
- Purpose and frontend use case.
- HTTP method and exact URL.
- Authentication requirements.
- Required permissions.
- Path parameters and query parameters.
- Filters, sorting, and pagination behavior.
- Request body, including field descriptions and validation.
- Response structure and representative examples.
- Possible domain errors and their expected handling.
- Important side effects or business behavior.
- Whether the operation is implemented or planned.

Reference the canonical Zod schemas and inferred types instead of unnecessarily duplicating their definitions. Examples should illustrate the actual contract, not create alternative definitions.

Document exactly what each endpoint does, what it expects, and what it returns.

### E. Frontend Screen-to-API Mapping

Provide a clear mapping between frontend screens and their corresponding API operations.

For example:

| Frontend feature | Operation ID | API endpoint | Purpose |
|---|---|---|---|
| Items listing | ITEM-LIST | GET /items | Retrieve items with filtering and pagination |
| Create item | ITEM-CREATE | POST /items | Create an item |
| Edit item | ITEM-UPDATE | PATCH /items/:id | Update an existing item |

Use actual module endpoints and contracts, not hypothetical endpoints presented as implemented functionality.

### F. Permissions and Access Control
- Document the permissions required for each operation.
- Explain which UI actions should be hidden, disabled, or inaccessible without permission.
- Document organization-level and record-level access restrictions where applicable.

### G. Cross-Module Dependencies
- Identify the modules this module depends on.
- Explain which public APIs and DTOs are consumed from each dependency.
- Document important relationships and coordination between modules.
- Never introduce duplicate ownership of another module's business logic.

### H. Acceptance Criteria
Define clear criteria for completing the frontend implementation, including expected workflows, validation, permissions, and error handling.

---

## 2. Server Specification — Backend Implementation Specification

Location:

`apps/server/src/api/modules/<module>/SPEC.md`

Create or update the server specification to describe how the backend implements the canonical contracts specification.

At the beginning, explicitly reference the corresponding contracts `SPEC.md` using a relative path.

The contracts specification remains authoritative for business requirements and public API behavior. The server specification must not independently redefine or contradict it.

Document:

### A. Implementation Overview
- Backend responsibilities and module boundaries.
- Current implementation status.
- Relevant internal files and their responsibilities.

### B. Endpoint Implementation
For every implemented endpoint, document:

- The corresponding operation ID from the contracts specification.
- Exact HTTP method and route.
- Route handler and service method.
- Authentication and authorization behavior.
- Input validation and schemas used.
- Business processing and response mapping.
- Possible domain errors.
- Transactions and side effects.

### C. Service and Business Logic
- Available service methods and their responsibilities.
- Important business rules implemented.
- Repository operations.
- Cross-module service interactions.
- Transaction boundaries and atomicity requirements.
- Activity logging and other required side effects.

### D. Database Responsibilities
- Relevant database entities and relationships.
- Owned tables and their responsibilities.
- Important constraints and indexes.
- Transactional operations and data integrity requirements.

Do not duplicate database schema definitions unnecessarily. Reference the actual schema files.

### E. Implementation Gaps
Explicitly identify:
- Missing endpoints.
- Partially implemented operations.
- Missing validation or business rules.
- Differences between the contracts and actual implementation.
- Outstanding tests or integration requirements.

### F. Backend Acceptance Criteria
Define when the backend implementation can be considered complete, including API behavior, authorization, business rules, transactions, tests, and consistency with contracts.

---

## 3. Synchronization and Source-of-Truth Rules

These rules are essential:

1. The contracts `SPEC.md` is the canonical specification for business requirements, frontend behavior, and public API expectations.
2. The server `SPEC.md` documents the actual backend implementation and references the contracts specification.
3. Every frontend operation must map to a documented API operation.
4. Every implemented endpoint must map to a documented operation ID.
5. The HTTP method, URL, request, response, permissions, and error behavior must remain consistent across both specifications and the actual implementation.
6. Never document a planned feature or endpoint as implemented.
7. Do not invent missing requirements, API endpoints, business rules, or response structures. Identify gaps explicitly.
8. Reference existing Zod schemas, inferred types, OpenAPI definitions, and public module APIs instead of maintaining redundant definitions.
9. Whenever a contract changes, review the corresponding server implementation and both specifications.
10. Whenever backend behavior changes, verify that it still satisfies the contracts specification.
11. If a discrepancy is found, explicitly identify it rather than silently changing one specification to match the other.
12. Avoid unnecessary duplication. Business requirements belong primarily in contracts; implementation details belong in server.

## 4. Agent Workflow

Establish a consistent workflow for future development agents.

### Frontend Agent
Before implementing a module:

1. Read the module's contracts `SPEC.md`.
2. Read its schemas, DTOs, constants, errors, and relevant public contracts.
3. Review the documented frontend screens and workflows.
4. Map each interaction to its documented API operation.
5. Identify dependencies on other modules.
6. Implement the UI according to the specification.
7. Report any missing, ambiguous, or contradictory requirement instead of inventing behavior.

The frontend agent should not need to inspect server implementation files to understand what the module is supposed to do.

### Backend Agent
Before implementing a module:

1. Read the contracts `SPEC.md`.
2. Read the server `SPEC.md`.
3. Inspect existing contracts and relevant module patterns.
4. Implement the endpoints and business behavior defined by the contracts.
5. Update the server specification to reflect the actual implementation.
6. Verify that all implemented endpoints and behavior satisfy the contracts.
7. Report any missing requirements or contract changes needed.

## 5. Specification Quality and Maintenance

- Keep specifications concise, structured, and easy for AI agents to navigate.
- Avoid repeating information already available in code or other documentation.
- Use stable operation IDs across contracts and server specifications.
- Use consistent terminology, naming, and status definitions across modules.
- Link to relevant source files rather than copying their contents.
- Keep planned, partially implemented, implemented, and deprecated functionality distinguishable.
- Update both specifications whenever relevant requirements or implementation behavior changes.
- Do not create empty sections, speculative requirements, or unnecessary boilerplate.

## 6. Deliverables

Inspect the existing project and its actual module structure before making changes.

Implement the documentation improvements across the relevant modules while:

- Preserving the original project structure.
- Following existing architecture and coding conventions.
- Avoiding unrelated refactoring.
- Keeping existing specifications and useful documentation intact while improving them.
- Ensuring relative references between contracts and server specifications resolve correctly.
- Identifying existing inconsistencies and gaps rather than concealing them.

Finally, provide a ZIP file containing the updated project with its original directory structure preserved, together with a concise summary of the modifications and any unresolved gaps.




### 3. Web Specification — Frontend Implementation Specification

Location:

`web/src/features/<module>/SPEC.md`

Create or update a specification for every frontend feature module.

This document must explicitly reference the corresponding contracts `SPEC.md` using a relative path. The contracts specification remains the source of truth for business requirements, UI requirements, and API contracts.

The Web SPEC documents how the frontend implements those requirements.

Include:

**A. Feature Structure**
- Feature responsibilities and boundaries.
- Pages, routes, layouts and navigation.
- Main components and their responsibilities.
- Relevant files and their locations.

**B. API Integration**
- Contracts operation IDs and corresponding endpoints.
- API client functions and generated hooks used.
- Query keys, parameters and mutation behavior.
- Caching, invalidation and refetching strategies.
- Request and response transformations, if any.
- Error handling.

**C. UI Implementation**
- Forms, tables, filters, dialogs, drawers and actions.
- Form schemas, defaults and validation.
- Component dependencies and reusable UI elements.
- Loading, empty, error, success and disabled states.
- Permission-aware rendering and behavior.

**D. Frontend State and Behavior**
- Server state and local state responsibilities.
- Query and mutation lifecycle.
- Form state and dependent fields.
- Search, filtering, sorting and pagination behavior.
- Navigation and post-operation behavior.

**E. Localization and Accessibility**
- English and Arabic translation namespaces.
- RTL behavior.
- Responsive layouts.
- Accessibility and interaction requirements.

**F. Dependencies**
- Shared components and utilities.
- Other frontend feature dependencies.
- Relevant contracts and public API dependencies.

**G. Implementation Status and Gaps**
- Implemented functionality.
- Partially implemented functionality.
- Missing functionality.
- Deviations from the contracts specification.
- Outstanding integration or testing requirements.

### Frontend Synchronization Rules

1. Always read the contracts SPEC before implementing a frontend feature.
2. Every frontend operation must map to a documented contracts operation ID.
3. API integrations must follow the documented request and response contracts.
4. Do not invent endpoints, business rules, validation rules or UI behavior.
5. Update the Web SPEC when the actual frontend implementation changes.
6. Distinguish planned implementation from actual implementation.
7. Report discrepancies between frontend implementation and contracts instead of silently introducing different behavior.
8. Reference actual source files rather than duplicating their implementation details.
9. Keep the Web SPEC focused on frontend implementation, avoiding duplication of backend internals or the complete contracts specification.



## 6. Mandatory Module TODO and AI Agent Progress Tracking

Every AI agent MUST create and maintain a `<module>.todo.md` file inside every package or application module it works on.

### File Locations

The TODO file must be located alongside the module's specification and implementation files.

Examples:

- `packages/contracts/src/<module>/<module>.todo.md`
- `apps/server/src/api/modules/<module>/<module>.todo.md`
- `web/src/features/<module>/<module>.todo.md`

Apply the same convention to any other package or application containing an assigned part of the module.

Each package/app must maintain its own TODO file because each represents a separate implementation responsibility.

### Purpose

The TODO file acts as the agent's persistent working memory and progress record.

An agent must be able to stop working, lose its conversation context, or resume in a completely new session and understand:

- What the original task is.
- What has already been completed.
- What is currently in progress.
- What remains to be implemented.
- What is blocked and why.
- What decisions have been made.
- Which files have been modified.
- What the next steps are.
- Which tests and verification commands have actually been executed.

### Required Structure

Use Markdown checklists with clear status sections:

#### Task Overview

A concise description of the assigned task and its expected outcome.

#### Pending

Tasks not started yet.

- [ ] Task description

#### In Progress

Tasks currently being worked on.

- [ ] Task description — started: YYYY-MM-DD HH\:mm

#### Completed

Tasks successfully implemented and verified.

- [x] Task description — completed: YYYY-MM-DD HH\:mm

#### Blocked

Tasks that cannot proceed, including the reason and required resolution.

- [ ] Task description — Blocked: reason

#### Decisions and Notes

Record important implementation decisions, assumptions, discovered dependencies, and relevant context needed to resume work.

#### Modified Files

Record the important files created, modified, or removed and briefly describe the changes.

#### Verification

Record tests, typechecks, linting, generation commands, and their actual results. Never mark verification as successful without executing it.

#### Next Steps

Clearly identify the immediate next actions for the next working session or agent.

### Mandatory Agent Workflow

**When starting work:**

1. Locate and read the module's TODO files in every package/app involved.
2. Read the relevant contracts, server, and web specifications.
3. Understand previous progress, decisions, blockers, and remaining tasks.
4. Resume from the existing progress instead of repeating completed work.

**While working:**

1. Update the TODO immediately when starting or completing a meaningful task.
2. Move tasks between Pending, In Progress, Completed, and Blocked as appropriate.
3. Record important decisions and discoveries so they are not lost with conversation context.
4. Keep the TODO synchronized with the actual repository state.
5. Update the relevant package/app TODO independently when work spans multiple locations.

**Before stopping, ending a session, or handing work to another agent:**

1. Update every affected TODO file.
2. Record exactly what was completed and what remains.
3. Record unresolved issues, blockers, and implementation decisions.
4. Identify the next concrete action.
5. Ensure the TODO accurately reflects the current code rather than merely reflecting the agent's intentions.

### Important Rules

- Creating and maintaining these files is mandatory, not optional.
- Never overwrite an existing TODO with a fresh checklist that loses previous progress.
- Never mark unfinished or unverified work as completed.
- Completed tasks should remain recorded unless the task itself is intentionally removed or superseded.
- Keep entries concise and actionable; do not duplicate the entire SPEC.md.
- Use timestamps in `YYYY-MM-DD HH:mm` format.
- Each package/app TODO tracks only the work relevant to that package/app.
- When work is resumed, the TODO files must be treated as the primary persistent progress record, alongside the specifications and actual repository state.
- When multiple agents work on different parts of the same module, each agent must respect the existing TODO records and avoid overwriting another agent's progress.

The objective is to make development resumable and resilient to lost AI conversation context, session interruptions, and agent handoffs.

