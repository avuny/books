---
name: web-feature-module
description: Build the web UI for a domain as a feature module under apps/web/src/features/<name>-module — API hooks with normalizers, types, pure lib logic, list (data table + mobile cards), create/update forms with dialog, details view, barrels and tests. Use whenever the task adds or changes a screen, list, form, dialog, details page, or table for a domain, or says "add the web part / frontend / UI for X", even when the user doesn't mention folders or patterns.
---

# Web feature module

One folder per domain, split into **pure views** and **containers**. The reference implementation is `role-module`; this skill rebuilds the same shape for a new domain (`project-module` below).

## Folder shape (copy this tree)

```
apps/web/src/features/project-module/
├── index.ts                    public surface: components + types only
├── types.ts                    re-export contract types + UI-only types
├── project-api.ts              ONLY file that knows @/api; normalizers + hooks
├── project-api.test.ts
├── components/
│   ├── index.ts
│   └── project-status-badge.tsx        tiny presentational pieces
├── lib/
│   ├── index.ts
│   ├── project-filters.ts              pure functions (+ .test.ts next to it)
│   └── use-project-labels.ts           hook turning enum/tokens into labels
├── list/
│   ├── index.ts
│   ├── project-columns.tsx             createProjectColumns({ copy, getActions })
│   ├── project-list.tsx                CONTAINER
│   └── project-mobile-card.tsx
├── forms/
│   ├── index.ts
│   ├── project-form-types.ts           ProjectFormCopy shared by create/update
│   ├── use-project-form-copy.ts        builds copy from t()
│   ├── create-project-form.tsx         PURE
│   ├── create-project.tsx              CONTAINER
│   ├── update-project-form.tsx         PURE
│   ├── update-project.tsx              CONTAINER (loads by id)
│   ├── project-button.tsx              opens dialog (create | edit)
│   └── project-dialog.tsx              controlled modal
└── details/
    ├── index.ts
    ├── project-details-view.tsx        PURE
    └── project-details.tsx             CONTAINER
```

Small domain? Skip folders you don't need (no `lib/` if nothing pure, no `details/` if no page) — but keep names and layering for what you do build.

## The two component kinds

| | Pure view | Container |
|---|---|---|
| Examples | `create-role-form.tsx`, `role-details-view.tsx`, `role-columns.tsx` | `create-role.tsx`, `role-details.tsx`, `role-list.tsx` |
| Knows | props only | `useTranslation`, `@…-api` hooks, abilities, `Intl`, `useState` |
| Strings | `copy` prop (typed `XCopy`) | builds `copy` with `t()` |
| Navigation | never | never — calls `onSuccess` / `onBack` / `onViewX` |
| Header comment | `// UI + validation only. No i18n, API, auth or navigation knowledge.` | `// Composition only: strings + API behavior wired into the pure …` |

## Build order (do not reorder)

1. **types.ts** — `references/templates-api-and-types.md`
2. **project-api.ts** (+ test) — same file
3. **lib/** — pure helpers + labels hook (+ tests)
4. **components/** — badges etc.
5. **forms/** — `references/templates-forms.md`
6. **list/** — `references/templates-list.md`
7. **details/** — `references/templates-details.md`
8. **index.ts barrels** at every level
9. **UI strings** → `.agents/skills/locales/SKILL.md` (namespace `project`)
10. **Route files** → `.agents/skills/web-routes/SKILL.md`

## Barrels (every folder)

```ts
// forms/index.ts
export * from "./create-project"
export * from "./create-project-form"
export * from "./project-button"
export * from "./project-dialog"
export * from "./project-form-types"
export * from "./update-project"
export * from "./update-project-form"
export * from "./use-project-form-copy"
```

```ts
// index.ts (module root) — NO api hooks here
export * from "./components"
export * from "./details"
export * from "./forms"
export * from "./list"
export type { ProjectDto, ProjectListItemDto, ProjectScope } from "./types"
```

## Imports cheat-sheet

```ts
import { Button } from "@workspace/ui/components/button"          // primitives
import { FormShell, InputField, SubmitButton } from "@workspace/ui/blocks/form"
import { DataTable, useDataTable /* … */ } from "@workspace/ui/blocks/data-table"
import { parseApiError } from "@workspace/ui/lib/api-error"
import { cn } from "@workspace/ui/lib/utils"
import { CreateProjectSchema } from "@avuny/contracts"             // schemas / types
import type { z } from "@avuny/zod"
import { useCreateProject } from "@/api"                           // ONLY in project-api.ts
```

## Styling rules

Semantic tokens only (`text-foreground`, `text-muted-foreground`, `bg-card`, `border-border`, `text-destructive`). Logical RTL utilities (`ps-6`, `pe-1`, `me-2`), `rtl:rotate-180` on arrows. Numbers in tables: `tabular-nums`. Empty states: `rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground`.

## Checklist

- [ ] No `useTranslation`/`@/api`/`useNavigate` inside a pure view
- [ ] `@/api` imported in exactly one file (`project-api.ts`)
- [ ] Mutations invalidate list key (+ detail key for update)
- [ ] Buttons/actions gated by `useProjectAbilities`
- [ ] Delete uses `ConfirmDialog`, shows server error, disables when business rule forbids
- [ ] Loading → `Skeleton` + `aria-busy`; error → `role="alert"`
- [ ] Barrels at every folder; root barrel exports no API hooks
- [ ] Tests: lib functions + `normalize*`
- [ ] Checked in Arabic/RTL
