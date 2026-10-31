# Rule: architecture & layering

**Direction of dependencies:** `contracts` ← `api`, `contracts` ← `web`. Contracts import nothing from api/web. Web never imports from api; API never imports from web.

**Layering inside a web feature** (lower layers never import higher ones):

```
lib/  (pure functions, label hooks, tests)         ← no API, no navigation
components/  (tiny presentational pieces)           ← no API, no i18n
<name>-api.ts  (generated client + normalizers)     ← no UI
forms/ list/ details/  (views = pure, containers = glue)
index.ts  (public surface)
```

✅ `list/role-list.tsx` (container) imports `../lib`, `../role-api`, `../forms`.
❌ `lib/role-permissions.ts` importing `../role-api`.

**Public surface:** a feature's root `index.ts` exports components + *types* only. API hooks stay internal.

```ts
// features/project-module/index.ts
export * from "./components"
export * from "./details"
export * from "./forms"
export * from "./list"
export type { ProjectDto, ProjectListItemDto, ProjectScope } from "./types"
```

**Barrels:** every folder has an `index.ts` with `export * from "./file"` lines. Siblings import `../lib`, `../components`, not deep file paths.

**Naming:** new feature folders are `<name>-module` (kebab, singular). Files are kebab-case, one exported component per file, file name = component name (`RoleTypeBadge` → `role-type-badge.tsx`).
