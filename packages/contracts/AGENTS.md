# AGENTS.md (packages/contracts)

Zod schemas, shared types, and request/response contracts for api, web and mobile.

## Rules

- Runtime-agnostic: pure schemas and types only. No Node, DOM, or DB imports.
- Import `z` only from `@avuny/zod`.
- Export one schema module per domain/feature, re-exported from `src/index.ts`.
- Types are inferred using `z.infer<typeof ...>`.
- No human-readable text inside contracts; validation uses message keys that clients and server translate.
- Single source of truth for API contracts: route definitions and client forms share these schemas.
