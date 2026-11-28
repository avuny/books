# AGENTS.md (packages/entitlements)

Shared entitlement domain code for the SaaS layer. Spec: `docs/modules/saas-architecture/SPEC.md` (sections 2 and 4) and `docs/modules/saas-architecture/PLATFORM-ADMIN-SPEC.md`.

## What belongs here
- The entitlement resolver (plan + add-ons + overrides + switches + dependencies -> snapshot), as a pure function over already-loaded inputs.
- Snapshot recompute orchestration and plan publish rules, written against **ports** (TypeScript interfaces) that the apps implement.
- Catalog helpers that are pure data logic.

## Rules
- Runtime-agnostic: no Node, DOM or `@avuny/db` imports. Database access is injected through ports; `apps/server` and `apps/platform-server` implement them with their repositories.
- Schemas, DTOs and error codes live in `@avuny/contracts`. Import them; never redefine them here.
- Import `z` from `@avuny/zod`, never from `zod`.
- Services return `Result<T, E>` (`@avuny/utils`).
- Every rule has a unit test named after its SPEC rule id (R1, R2, ...). No test needs a database.
- Do not read plans or subscriptions anywhere else in the codebase; everything asks the resolver or the stored snapshot (SPEC section 14).

## Status
Scaffold only. Next work: phase S2 in `docs/modules/saas-architecture/PROGRESS.md`.
