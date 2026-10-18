# AGENTS.md (packages/utils)

Runtime-agnostic utility helpers, including the Result pattern (`ok`, `fail`).

## Rules

- Runtime-agnostic: pure helpers only. No Node, DOM, or DB imports.
- Domain services return `Result<T, E>` (`ok()` / `fail()`) from `@avuny/utils`.
- Only generic, pure utility functions belong here. Domain logic belongs in services or features.
