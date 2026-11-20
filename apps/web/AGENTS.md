# AGENTS.md — Web app (`apps/web`)

Everything an AI agent needs to build web modules here: rules, workflow, folder layout, copy-paste templates, routes, locales, permissions.
Worked example throughout: a new **project** module (`project-module`). Replace `project` / `Project` with your domain.

> ⚠ = inferred, not read from the repo. Verify once, fix, delete the marker.

## Contents

1. [Map & stack](#1-map--stack)
2. [Golden rules](#2-golden-rules)
3. [Workflow: build a web module](#3-workflow-build-a-web-module)
4. [Feature module anatomy](#4-feature-module-anatomy)
5. [Templates: types + API file](#5-templates-types--api-file)
6. [Templates: lib + components](#6-templates-lib--components)
7. [Templates: forms](#7-templates-forms)
8. [Templates: list](#8-templates-list)
9. [Templates: details](#9-templates-details)
10. [Routes (TanStack Router)](#10-routes-tanstack-router)
11. [Locales (en + ar) & RTL](#11-locales-en--ar--rtl)
12. [Permissions in the web](#12-permissions-in-the-web)
13. [Styling & accessibility](#13-styling--accessibility)
14. [Testing](#14-testing)
15. [Commands & definition of done](#15-commands--definition-of-done)
16. [Anti-patterns](#16-anti-patterns)
17. [Pattern: async combobox field](#17-pattern-async-combobox-field-searchable-paginated-server-backed-select)

---

## 1. Map & stack

| Thing | Path / import |
|---|---|
| Features | `apps/web/src/features/<name>-module/` |
| Routes | `apps/web/src/routes/` (TanStack file routes; `routeTree.gen.ts` is generated, never edit) |
| Generated API client | `@/api` — hook names come from the backend route's `operationId` (`listProjects` → `useListProjects`, `getListProjectsQueryKey`) |
| Shared contracts | `@avuny/contracts` (Zod schemas, DTO types, error codes, `hasPermission`, locale JSON) |
| Zod | `@avuny/zod` (`import type { z } from "@avuny/zod"`; never `zod`) |
| UI kit | `@workspace/ui/components/*` (shadcn-style), `@workspace/ui/blocks/form`, `@workspace/ui/blocks/data-table`, `@workspace/ui/blocks/layout/navbar`, `@workspace/ui/lib/api-error`, `@workspace/ui/lib/utils` (`cn`), `@workspace/ui/providers/*` |

Stack: React, TanStack Router + Query + Table, react-hook-form + `zodResolver`, react-i18next (en + ar, RTL), Tailwind with semantic tokens, Vitest, lucide-react.

Data flow: `contracts → backend → generated client (@/api) → <name>-api.ts → containers → pure views → route`.

## 2. Golden rules

1. **Contracts first.** Types/schemas come from `@avuny/contracts`, re-exported by the feature's `types.ts`. Never redefine a request/response shape in the web.
2. **Pure views + containers.** Views take already-translated `copy` and data; only containers call `useTranslation`, API hooks, abilities, `Intl`, or hold server-error/dialog state.
3. **Only `<name>-api.ts` imports `@/api`.** It normalizes responses; everything else consumes normalized values.
4. **Features never navigate.** They expose callbacks (`onSuccess`, `onBack`, `onViewProject`); the route decides the destination.
5. **Routes are thin**: params → `useNavigate` → one feature component.
6. **No hard-coded user-facing strings** (labels, placeholders, aria-labels, "coming soon").
7. **Every string in both `en` and `ar`**, identical keys.
8. **RTL-safe:** logical utilities (`ps-/pe-/ms-/me-/text-start`), `rtl:rotate-180` on directional icons.
9. **Semantic Tailwind tokens only** (`text-foreground`, `text-muted-foreground`, `bg-card`, `border-border`, `text-destructive`) — no raw colors.
10. **UI permission gating is cosmetic.** The server enforces; the web only hides.
11. **Barrels everywhere:** each folder has `index.ts` with `export * from "./file"`; the module root exports components + types only (no API hooks).
12. **Tests for pure logic** (`lib/*.test.ts`) and normalizers (`<name>-api.test.ts`).

## 3. Workflow: build a web module

Do phases in order; each ends with a gate. The backend endpoints and contracts must already exist (if not, stop and say so).

| # | Phase | Do | Gate |
|---|---|---|---|
| 0 | Clarify | Module name, fields, which endpoints exist, who can create/update/delete, UI surfaces (list / details / dialog), business rules visible in UI (e.g. "can't delete while it has members"). Missing answer → take the default, state it as an assumption. | assumptions written down |
| 1 | Client | Confirm `@/api` exports the hooks you need (`useListProjects`, `useGetProject`, `useCreateProject`, `useUpdateProject`, `useDeleteProject`, query-key getters). Regenerate if not ⚠. | hooks exist |
| 2 | Types + API file | §5. `types.ts`, `project-api.ts`, `project-api.test.ts` | vitest passes |
| 3 | Lib + components | §6 | pure functions tested |
| 4 | Forms | §7 (entity pickers → §17) | create + edit work in a dialog |
| 5 | List | §8 | paging, search, tabs, delete, mobile card |
| 6 | Details | §9 | loading / error / loaded states |
| 7 | Barrels | §4 | root exports components + types only |
| 8 | Strings | §11, en **and** ar | parity check passes |
| 9 | Routes | §10 | list → details → back works |
| 10 | Verify | §15 | typecheck, lint, tests; LTR + RTL; forbidden user sees no buttons |

**Prompt template for delegating:**

```
Build the web part of <project> following AGENTS.md.
Endpoints exist: list/get/create/update/delete under /organizations/{orgId}/projects.
Fields: name (2–80), description (≤500), status (draft|active|archived).
UI: list with status tabs + search, details page, create/edit dialog, delete confirm.
Permissions: create:project, update:project, delete:project (hide UI accordingly).
Strings: en + ar. Stop after each phase gate and summarize.
```

**Naming map**

| Thing | Name |
|---|---|
| Feature folder | `features/project-module/` |
| API hooks | `useProjectList`, `useProject`, `useProjectAbilities`, `useCreateProjectMutation`, `useUpdateProjectMutation`, `useDeleteProjectMutation` |
| Pure view / container | `CreateProjectForm` / `CreateProject`, `ProjectDetailsView` / `ProjectDetails` |
| Copy types | `ProjectFormCopy`, `ProjectDetailsViewCopy`, `ProjectColumnsCopy`, `ProjectMobileCardCopy` |
| Labels hook | `useProjectLabels` |
| i18n namespace | `project` |
| Route files | `routes/organization/$orgId/projects/index.tsx`, `…/$projectId.tsx` |

## 4. Feature module anatomy

New feature folders are named `<name>-module` (kebab, singular) ⚠ (`role-module` does; older `organization` doesn't).

```
features/project-module/
├── index.ts                     components + types ONLY
├── types.ts                     re-export contract types + UI-only types
├── project-api.ts               ONLY file that knows @/api
├── project-api.test.ts
├── components/                  tiny presentational pieces
│   ├── index.ts
│   └── project-status-badge.tsx
├── lib/                         pure logic + labels hook (+ .test.ts beside each)
│   ├── index.ts
│   └── use-project-labels.ts
├── list/
│   ├── index.ts
│   ├── project-columns.tsx      PURE: createProjectColumns({ copy, getActions })
│   ├── project-list.tsx         CONTAINER
│   └── project-mobile-card.tsx  PURE
├── forms/
│   ├── index.ts
│   ├── project-form-types.ts    ProjectFormCopy (shared by create/update)
│   ├── use-project-form-copy.ts builds copy from t()
│   ├── create-project-form.tsx  PURE
│   ├── create-project.tsx       CONTAINER
│   ├── update-project-form.tsx  PURE
│   ├── update-project.tsx       CONTAINER (loads by id)
│   ├── project-button.tsx       opens dialog (create | edit)
│   └── project-dialog.tsx       controlled modal
└── details/
    ├── index.ts
    ├── project-details-view.tsx PURE
    └── project-details.tsx      CONTAINER
```

Skip folders you don't need, keep names and layering for what you build.

**Layering (lower never imports higher):** `lib/` + `components/` → `project-api.ts` → `forms/` `list/` `details/` → `index.ts`. `lib/` must not import the API file.

| | Pure view | Container |
|---|---|---|
| Knows | props only | `useTranslation`, api hooks, abilities, `Intl`, `useState` |
| Strings | typed `copy` prop | builds `copy` with `t()` |
| Header comment | `// UI + validation only. No i18n, API, auth or navigation knowledge.` | `// Composition only: strings + API behavior wired into the pure …` |

**Barrels:**

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

// features/project-module/index.ts — no API hooks here
export * from "./components"
export * from "./details"
export * from "./forms"
export * from "./list"
export type { ProjectDto, ProjectListItemDto, ProjectScope } from "./types"
```

Siblings import `../lib`, `../components` (not deep file paths). Routes import only from `@/features/project-module`.

## 5. Templates: types + API file

**types.ts**

```ts
import type {
  CreateProjectInput, ProjectDto, ProjectListItemDto, UpdateProjectInput,
} from "@avuny/contracts"

export type { CreateProjectInput, ProjectDto, ProjectListItemDto, UpdateProjectInput }

// UI-only types live here, never in the contracts.
export type ProjectScope = "all" | "draft" | "active" | "archived"
```

**project-api.ts** — if the generated client's shape changes, this is the only file to fix.

```ts
/**
 * The only file in this module that knows the shape of the generated API
 * client (@/api). Everything else consumes the normalized values returned here.
 */
import { useMemo } from "react"
import { keepPreviousData, useQueryClient } from "@tanstack/react-query"
import { hasPermission, type PermissionSnapshot } from "@avuny/contracts"

import {
  getGetProjectQueryKey, getListProjectsQueryKey,
  useCreateProject, useDeleteProject, useGetMyPermissions,
  useGetProject, useListProjects, useUpdateProject,
} from "@/api"

import type { ProjectDto, ProjectListItemDto, ProjectScope } from "./types"

const NO_PROJECTS: ProjectListItemDto[] = []   // stable empty ref: no new [] per render

// ⚠ role-module/role-api.ts has the same helper. Don't deep-import another feature's
// internals: extract to a shared place (ask maintainers) or keep this private copy.
function normalizeStatement(s: { effect?: string; resource: string; action: string; resourceId?: string }) {
  return {
    effect: s.effect === "deny" ? ("deny" as const) : ("allow" as const),
    resource: s.resource,
    action: s.action,
    resourceId: s.resourceId ?? "*",
  }
}

/* ------------------------------ normalizers ------------------------------ */
export function normalizeProject(data: {
  id: string; orgId: string; name: string
  description?: string | null
  status: string
  createdAt: string; updatedAt: string
}): ProjectDto {
  return { ...data, description: data.description ?? null, status: data.status as ProjectDto["status"] }
}

/* -------------------------------- queries -------------------------------- */
export type ProjectListParams = { page: number /* 1-based */; pageSize: number; scope: ProjectScope; search: string }

export function useProjectList(orgId: string, { page, pageSize, scope, search }: ProjectListParams) {
  const query = useListProjects(
    orgId,
    { page, pageSize, status: scope === "all" ? undefined : scope, search: search || undefined },
    { query: { placeholderData: keepPreviousData } }          // no flash between pages
  )
  return {
    projects: query.data?.data.items ?? NO_PROJECTS,
    total: query.data?.data.total ?? 0,
    isLoading: query.isLoading,
  }
}

export function useProject(orgId: string, projectId: string) {
  const query = useGetProject(orgId, projectId)
  const data = query.data?.data
  const project = useMemo<ProjectDto | null>(() => (data ? normalizeProject(data) : null), [data])
  return { project, isLoading: query.isLoading, error: query.error }
}

/** What the signed-in user may do; used ONLY to show/hide UI. */
export function useProjectAbilities(orgId: string) {
  const query = useGetMyPermissions(orgId)
  const snapshot = query.data?.data
  return useMemo(() => {
    if (!snapshot) return { canCreate: false, canUpdate: false, canDelete: false }
    const s: PermissionSnapshot = {
      isOwner: snapshot.isOwner,
      statements: snapshot.statements.map(normalizeStatement),
    }
    return {
      canCreate: hasPermission(s, "create:project"),
      canUpdate: hasPermission(s, "update:project"),
      canDelete: hasPermission(s, "delete:project"),
    }
  }, [snapshot])
}

/* ------------------------------- mutations ------------------------------- */
function useInvalidateProjects(orgId: string) {
  const queryClient = useQueryClient()
  return (projectId?: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey(orgId) }),
      projectId
        ? queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(orgId, projectId) })
        : Promise.resolve(),
    ])
}

/** `mutateAsync({ orgId, data })` */
export function useCreateProjectMutation(orgId: string) {
  const invalidate = useInvalidateProjects(orgId)
  return useCreateProject({ mutation: { onSuccess: () => invalidate() } })
}
/** `mutateAsync({ orgId, projectId, data })` */
export function useUpdateProjectMutation(orgId: string) {
  const invalidate = useInvalidateProjects(orgId)
  return useUpdateProject({ mutation: { onSuccess: (_res, vars) => invalidate(vars.projectId) } })
}
/** `mutateAsync({ orgId, projectId })` */
export function useDeleteProjectMutation(orgId: string) {
  const invalidate = useInvalidateProjects(orgId)
  return useDeleteProject({ mutation: { onSuccess: () => invalidate() } })
}
```

Mutation variables = path params + `data` for the body. Keep `search || undefined` so `""` never reaches the server.

**project-api.test.ts**

```ts
import { describe, expect, it } from "vitest"
import { normalizeProject } from "./project-api"

describe("project-api normalization", () => {
  it("turns a missing description into null", () => {
    const p = normalizeProject({
      id: "p1", orgId: "o1", name: "Alpha", status: "draft",
      createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
    })
    expect(p.description).toBeNull()
  })
})
```

## 6. Templates: lib + components

**lib/use-project-labels.ts** — open sets (enums that may grow) always use `defaultValue`, so a new backend value never renders a missing-key string.

```ts
import { useCallback } from "react"
import { useTranslation } from "react-i18next"

export function useProjectLabels() {
  const { t } = useTranslation("project")
  const getStatusLabel = useCallback(
    (status: string) => t(`labels.${status}`, { defaultValue: status }),
    [t]
  )
  return { getStatusLabel }
}
```

Pure helpers (filtering, grouping, toggling selections) go in `lib/<thing>.ts` as plain functions with a sibling `<thing>.test.ts`. Copy the style of `role-permissions.ts`: small named functions, `readonly` array params, doc comment saying what is kept untouched.

**components/project-status-badge.tsx**

```tsx
import { Badge } from "@workspace/ui/components/badge"

export interface ProjectStatusBadgeProps {
  status: "draft" | "active" | "archived"
  /** Already-translated label. */
  label: string
}

export function ProjectStatusBadge({ status, label }: ProjectStatusBadgeProps) {
  return <Badge variant={status === "active" ? "secondary" : "outline"}>{label}</Badge>
}
```

Components in `components/` receive translated labels as props — they never call `useTranslation`.

## 7. Templates: forms

Order: `project-form-types.ts` → `use-project-form-copy.ts` → pure forms → containers → button → dialog → barrel.

**forms/project-form-types.ts**

```ts
import type { FieldCopy } from "@workspace/ui/blocks/types"

/** Localized strings shared by the create and update forms. */
export type ProjectFormCopy = {
  title: string
  description: string
  name: FieldCopy                 // { label, placeholder }
  projectDescription: FieldCopy   // not "description": clashes with the form description above
  submitLabel: string
  submittingLabel: string
}
```

**forms/use-project-form-copy.ts**

```ts
import { useTranslation } from "react-i18next"
import type { ProjectFormCopy } from "./project-form-types"

export function useProjectFormCopy(mode: "create" | "update"): ProjectFormCopy {
  const { t } = useTranslation("project")
  return {
    title: t(`${mode}.title`),
    description: t(`${mode}.description`),
    name: { label: t("fields.name.label"), placeholder: t("fields.name.placeholder") },
    projectDescription: {
      label: t("fields.description.label"),
      placeholder: t("fields.description.placeholder"),
    },
    submitLabel: t(`${mode}.submitLabel`),
    submittingLabel: t(`${mode}.submittingLabel`),
  }
}
```

**forms/create-project-form.tsx — PURE**

```tsx
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { CreateProjectSchema } from "@avuny/contracts"

import { FormShell, InputField, SubmitButton } from "@workspace/ui/blocks/form"

import type { CreateProjectInput } from "../types"
import type { ProjectFormCopy } from "./project-form-types"

import type { z } from "@avuny/zod"

export type CreateProjectFormValues = CreateProjectInput
type CreateProjectFormInput = z.input<typeof CreateProjectSchema>   // pre-transform shape

type CreateProjectFormProps = {
  copy: ProjectFormCopy
  onSubmit: (values: CreateProjectFormValues) => void
  isPending: boolean
  /** Already localized. Shown in the form-level alert. */
  errorMessage?: string | null
}

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function CreateProjectForm({ copy, onSubmit, isPending, errorMessage }: CreateProjectFormProps) {
  // generics: <input shape, context, output shape>
  const form = useForm<CreateProjectFormInput, unknown, CreateProjectFormValues>({
    resolver: zodResolver(CreateProjectSchema),
    defaultValues: { name: "", description: "" },
  })

  return (
    <FormShell title={copy.title} description={copy.description} errorMessage={errorMessage}>
      <form onSubmit={form.handleSubmit((values) => onSubmit(values))} noValidate className="space-y-6">
        <InputField control={form.control} name="name" copy={copy.name}
          type="text" autoComplete="off" autoFocus disabled={isPending} />
        <InputField control={form.control} name="description" copy={copy.projectDescription}
          type="text" autoComplete="off" disabled={isPending} />
        <SubmitButton className="w-full" loading={isPending}
          label={copy.submitLabel} loadingLabel={copy.submittingLabel} />
      </form>
    </FormShell>
  )
}
```

**Picking an existing entity (role, customer, project…) from a list that can grow?** Don't use a static `SelectField`; use the async combobox pattern in [§17](#17-pattern-async-combobox-field-searchable-paginated-server-backed-select).

Non-text field? Wrap it in `Controller` (as `RolePermissionsField` does):

```tsx
<Controller control={form.control} name="permissions"
  render={({ field, fieldState }) => (
    <MyField value={field.value ?? []} onChange={field.onChange}
      disabled={isPending} errorMessage={fieldState.error?.message} />
  )} />
```

**forms/update-project-form.tsx — PURE.** Same as create, plus a `project: ProjectDto` prop and `UpdateProjectSchema`:

```tsx
const form = useForm<UpdateProjectFormInput, unknown, UpdateProjectFormValues>({
  resolver: zodResolver(UpdateProjectSchema),
  defaultValues: { name: project.name, description: project.description ?? "" },
})
```

**forms/create-project.tsx — CONTAINER**

```tsx
import { useState } from "react"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { normalizeProject, useCreateProjectMutation } from "../project-api"
import type { ProjectDto } from "../types"
import { CreateProjectForm, type CreateProjectFormValues } from "./create-project-form"
import { useProjectFormCopy } from "./use-project-form-copy"

type CreateProjectProps = {
  orgId: string
  onSuccess?: (project: ProjectDto) => void   // the caller decides what happens next
}

// Composition only: strings + API behavior wired into the pure form.
export function CreateProject({ orgId, onSuccess }: CreateProjectProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const createMutation = useCreateProjectMutation(orgId)
  const copy = useProjectFormCopy("create")

  // Called only when Zod validation passes (react-hook-form guards the fields).
  const handleSubmit = async (values: CreateProjectFormValues) => {
    setServerError(null)
    try {
      const response = await createMutation.mutateAsync({
        orgId,
        data: { ...values, description: values.description?.trim() || null },   // "" → null
      })
      onSuccess?.(normalizeProject(response.data))
    } catch (e) {
      setServerError(parseApiError(e).message || null)   // already localized by the server
    }
  }

  return (
    <CreateProjectForm copy={copy} onSubmit={handleSubmit}
      isPending={createMutation.isPending} errorMessage={serverError} />
  )
}
```

**forms/update-project.tsx — CONTAINER (loads by id).** List rows may lack fields, so load by id, skeleton, then the pure form:

```tsx
const { project, isLoading, error } = useProject(orgId, projectId)
// mutation + handleSubmit like create, but mutateAsync({ orgId, projectId, data })

if (isLoading) {
  return (
    <div className="grid gap-4" aria-busy>
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
  )
}
if (!project) {
  return <p role="alert" className="text-sm text-destructive">{error ? parseApiError(error).message : null}</p>
}
return <UpdateProjectForm copy={copy} project={project} onSubmit={handleSubmit}
  isPending={updateMutation.isPending} errorMessage={serverError} />
```

**forms/project-button.tsx** — one component, two modes. No `projectId` → "Create" (primary, `Plus`). With `projectId` → "Edit" (`Pencil`, outline or icon via `display`).

```tsx
type ProjectButtonProps = {
  orgId: string
  /** Given: opens the update dialog. Omitted: opens the create dialog. */
  projectId?: string
  display?: "icon" | "text"   // update only
  className?: string
}
// const [open, setOpen] = useState(false)
// label = t(isUpdate ? "actions.edit" : "actions.create")
// icon-only button MUST have aria-label={label}; icons get aria-hidden
// renders trigger + <ProjectDialog orgId projectId open onOpenChange={setOpen} />
```

**forms/project-dialog.tsx**

```tsx
export function ProjectDialog({ orgId, projectId, open, onOpenChange }: ProjectDialogProps) {
  const { t } = useTranslation("project")
  const mode = projectId ? "update" : "create"
  const close = () => onOpenChange(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {/* The form's own heading is visible; this one names the dialog for screen readers. */}
        <DialogHeader className="sr-only">
          <DialogTitle>{t(`${mode}.title`)}</DialogTitle>
          <DialogDescription>{t(`${mode}.description`)}</DialogDescription>
        </DialogHeader>
        {projectId ? (
          <UpdateProject key={projectId} orgId={orgId} projectId={projectId} onSuccess={close} />
        ) : (
          <CreateProject orgId={orgId} onSuccess={close} />
        )}
      </DialogContent>
    </Dialog>
  )
}
```

`key={projectId}` resets form state per record. The list uses `ProjectDialog` directly for the row-menu "Edit" (a menu item can't own a dialog).

## 8. Templates: list

**list/project-columns.tsx — PURE**

```tsx
import type { ColumnDef } from "@tanstack/react-table"
import { createActionsColumn, type RowAction } from "@workspace/ui/blocks/data-table"

import { ProjectStatusBadge } from "../components"
import type { ProjectListItemDto } from "../types"

export type ProjectColumnsCopy = {
  name: string; status: string; members: string; actions: string
  /** aria-label of the row menu button. */
  actionsFor: (projectName: string) => string
  getStatusLabel: (status: string) => string
}

type ProjectColumnsOptions = {
  copy: ProjectColumnsCopy
  getActions: (project: ProjectListItemDto) => RowAction[]
}

export function createProjectColumns({ copy, getActions }: ProjectColumnsOptions): ColumnDef<ProjectListItemDto>[] {
  return [
    {
      accessorKey: "name", header: copy.name,
      enableSorting: false,             // server-side paging: sorting off unless the API supports it
      cell: ({ row }) => <div className="font-medium text-foreground">{row.original.name}</div>,
    },
    {
      id: "status", header: copy.status, enableSorting: false,
      cell: ({ row }) => (
        <ProjectStatusBadge status={row.original.status} label={copy.getStatusLabel(row.original.status)} />
      ),
    },
    {
      accessorKey: "memberCount", header: copy.members, enableSorting: false,
      cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.original.memberCount}</span>,
    },
    createActionsColumn<ProjectListItemDto>({
      headerLabel: copy.actions,
      triggerLabel: (p) => copy.actionsFor(p.name),
      getActions,
    }),
  ]
}
```

**list/project-mobile-card.tsx — PURE** (shown below `md`)

```tsx
import { DataTableMobileCard, DataTableRowActions, type RowAction } from "@workspace/ui/blocks/data-table"

export function ProjectMobileCard({ project, copy, actions, actionsTriggerLabel, onClick }: ProjectMobileCardProps) {
  return (
    <DataTableMobileCard
      title={project.name}
      badge={<ProjectStatusBadge status={project.status} label={copy.getStatusLabel(project.status)} />}
      fields={[{ label: copy.membersLabel, value: project.memberCount }]}
      actions={<DataTableRowActions actions={actions} triggerLabel={actionsTriggerLabel} />}
      onClick={onClick}
    />
  )
}
```

**list/project-list.tsx — CONTAINER** (the skeleton to copy)

```tsx
const SCOPES: readonly ProjectScope[] = ["all", "draft", "active", "archived"]

type ProjectListProps = {
  orgId: string
  /** The route decides how to navigate to the project page. */
  onViewProject: (projectId: string) => void
}

// Composition only: strings + API behavior wired into the pure data-table kit.
export function ProjectList({ orgId, onViewProject }: ProjectListProps) {
  const { t } = useTranslation("project")

  /* state */
  const [scope, setScope] = useState<ProjectScope>("all")
  const [search, setSearch] = useState("")
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 })
  const [projectToEdit, setProjectToEdit] = useState<ProjectListItemDto | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<ProjectListItemDto | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const resetPage = useCallback(() => setPagination((c) => ({ ...c, pageIndex: 0 })), [])

  /* data */
  const { projects, total, isLoading } = useProjectList(orgId, {
    page: pagination.pageIndex + 1, pageSize: pagination.pageSize, scope, search,
  })
  const abilities = useProjectAbilities(orgId)
  const { getStatusLabel } = useProjectLabels()
  const deleteMutation = useDeleteProjectMutation(orgId)

  // Deleting the last row of the last page leaves an empty page: step back.
  useEffect(() => {
    if (!isLoading && projects.length === 0 && pagination.pageIndex > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPagination((c) => ({ ...c, pageIndex: c.pageIndex - 1 }))
    }
  }, [isLoading, projects.length, pagination.pageIndex])

  /* row actions: view → edit → delete (destructive, separated) */
  const getActions = useCallback((project: ProjectListItemDto): RowAction[] => {
    const actions: RowAction[] = [
      { id: "view", label: t("actions.view"), icon: <Eye className="size-4" />,
        onSelect: () => onViewProject(project.id) },
    ]
    if (abilities.canUpdate)
      actions.push({ id: "edit", label: t("actions.edit"), icon: <Pencil className="size-4" />,
        onSelect: () => setProjectToEdit(project) })
    if (abilities.canDelete)
      actions.push({
        id: "delete", label: t("actions.delete"), icon: <Trash2 className="size-4" />,
        variant: "destructive", separatorBefore: true,
        disabled: project.memberCount > 0,          // business rule mirrored from the server
        onSelect: () => setProjectToDelete(project),
      })
    return actions
  }, [t, onViewProject, abilities.canUpdate, abilities.canDelete])

  /* columns + table */
  const columns = useMemo(() => createProjectColumns({
    copy: {
      name: t("table.name"), status: t("table.status"), members: t("table.members"),
      actions: t("table.actions"),
      actionsFor: (name) => t("table.actionsFor", { name }),
      getStatusLabel,
    },
    getActions,
  }), [t, getActions, getStatusLabel])

  const table = useDataTable<ProjectListItemDto>({
    data: projects, columns, getRowId: (p) => p.id,
    manual: true, rowCount: total, pagination, onPaginationChange: setPagination,
  })
  const paginationProps = getTablePaginationProps(table)

  /* delete */
  const closeDeleteDialog = () => { setProjectToDelete(null); setDeleteError(null) }
  const handleDelete = async () => {
    if (!projectToDelete) return
    setDeleteError(null)
    try {
      await deleteMutation.mutateAsync({ orgId, projectId: projectToDelete.id })
      closeDeleteDialog()
    } catch (e) {
      setDeleteError(parseApiError(e).message || null)   // dialog stays open, shows server message
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-foreground">{t("list.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("list.description")}</p>
      </div>

      <DataTableViewTabs
        ariaLabel={t("list.tabs.aria")}
        value={scope}
        onValueChange={(value) => {
          const next = SCOPES.find((item) => item === value)   // narrow string → union safely
          if (!next) return
          setScope(next); resetPage()
        }}
        tabs={SCOPES.map((item) => ({ value: item, label: t(`list.tabs.${item}`) }))}
      />

      <DataTableToolbar
        search={
          <DataTableSearch value={search}
            onChange={(next) => { setSearch(next); resetPage() }}
            placeholder={t("list.search.placeholder")} clearLabel={t("list.search.clear")} />
        }
        actions={abilities.canCreate ? <ProjectButton orgId={orgId} /> : null}
      />

      <DataTable
        table={table}
        isLoading={isLoading}
        onRowClick={(p) => onViewProject(p.id)}
        emptyState={
          <div className="flex flex-col items-center gap-1 px-6 py-16 text-center">
            <p className="text-sm font-medium text-foreground">{t("empty.title")}</p>
            <p className="text-sm text-muted-foreground">{t("empty.description")}</p>
          </div>
        }
        renderMobileCard={(row) => (
          <ProjectMobileCard
            project={row.original}
            copy={{ membersLabel: t("table.members"), getStatusLabel }}
            actions={getActions(row.original)}
            actionsTriggerLabel={t("table.actionsFor", { name: row.original.name })}
            onClick={() => onViewProject(row.original.id)}
          />
        )}
        footer={
          <DataTablePagination {...paginationProps} copy={{
            navLabel: t("pagination.nav"), previous: t("pagination.previous"), next: t("pagination.next"),
            rowsPerPage: t("pagination.rowsPerPage"),
            summary: ({ from, to, total: count }) => t("pagination.summary", { from, to, total: count }),
            pageOf: (page, pageCount) => t("pagination.pageOf", { page, pageCount }),
            pageLabel: (page) => t("pagination.goTo", { page }),
          }} />
        }
      />

      {projectToEdit ? (
        <ProjectDialog orgId={orgId} projectId={projectToEdit.id} open
          onOpenChange={(open) => { if (!open) setProjectToEdit(null) }} />
      ) : null}

      <ConfirmDialog
        open={projectToDelete !== null}
        onOpenChange={(open) => { if (!open) closeDeleteDialog() }}
        title={t("delete.title")}
        description={deleteError ?? t("delete.description", { name: projectToDelete?.name })}
        confirmLabel={t("actions.delete")} cancelLabel={t("actions.cancel")}
        isLoading={deleteMutation.isPending} onConfirm={handleDelete}
      />
    </div>
  )
}
```

Every filter/search change calls `resetPage()`. Imports for the list: `PaginationState` from `@tanstack/react-table`; `Eye, Pencil, Trash2` from `lucide-react`; `ConfirmDialog, DataTable, DataTablePagination, DataTableSearch, DataTableToolbar, DataTableViewTabs, getTablePaginationProps, useDataTable, type RowAction` from `@workspace/ui/blocks/data-table`.

## 9. Templates: details

**details/project-details-view.tsx — PURE**

```tsx
import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { ProjectStatusBadge } from "../components"
import type { ProjectDto } from "../types"

export type ProjectDetailsViewCopy = {
  backLabel: string
  statusLabel: string          // already-translated status of THIS project
  createdLabel: string
  updatedLabel: string
}

export interface ProjectDetailsViewProps {
  project: ProjectDto | null
  isLoading: boolean
  /** Already localized. Shown instead of the project when loading failed. */
  errorMessage?: string | null
  copy: ProjectDetailsViewCopy
  /** Already formatted for the current locale. */
  createdAt: string
  updatedAt: string
  onBack?: () => void
  /** Usually <ProjectButton />; omit when the user can't edit. */
  editAction?: ReactNode
}

export function ProjectDetailsView({ project, isLoading, errorMessage, copy, createdAt, updatedAt, onBack, editAction }: ProjectDetailsViewProps) {
  return (
    <div className="flex flex-col gap-6">
      {onBack ? (
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
            {copy.backLabel}
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4" aria-busy>
          <Skeleton className="h-7 w-1/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : !project ? (
        <p role="alert" className="text-sm text-destructive">{errorMessage}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-foreground">{project.name}</h1>
                <ProjectStatusBadge status={project.status} label={copy.statusLabel} />
              </div>
              {project.description ? <p className="text-sm text-muted-foreground">{project.description}</p> : null}
            </div>
            {editAction}
          </div>

          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">{copy.createdLabel}</dt>
              <dd className="text-foreground">{createdAt}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{copy.updatedLabel}</dt>
              <dd className="text-foreground">{updatedAt}</dd>
            </div>
          </dl>
        </>
      )}
    </div>
  )
}
```

**details/project-details.tsx — CONTAINER**

```tsx
import { useTranslation } from "react-i18next"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { ProjectButton } from "../forms"
import { useProjectLabels } from "../lib"
import { useProject, useProjectAbilities } from "../project-api"
import { ProjectDetailsView } from "./project-details-view"

type ProjectDetailsProps = {
  orgId: string
  projectId: string
  /** The route decides where "Back" goes. */
  onBack?: () => void
}

// Composition only: strings + API behavior wired into the pure view.
export function ProjectDetails({ orgId, projectId, onBack }: ProjectDetailsProps) {
  const { t, i18n } = useTranslation("project")
  const { project, isLoading, error } = useProject(orgId, projectId)
  const abilities = useProjectAbilities(orgId)
  const { getStatusLabel } = useProjectLabels()

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(new Date(iso))

  const canEdit = abilities.canUpdate && project !== null   // add business rules here (e.g. not archived)

  return (
    <ProjectDetailsView
      project={project}
      isLoading={isLoading}
      errorMessage={error ? parseApiError(error).message : null}
      copy={{
        backLabel: t("details.back"),
        statusLabel: project ? getStatusLabel(project.status) : "",
        createdLabel: t("details.createdAt"),
        updatedLabel: t("details.updatedAt"),
      }}
      createdAt={project ? formatDate(project.createdAt) : ""}
      updatedAt={project ? formatDate(project.updatedAt) : ""}
      onBack={onBack}
      editAction={canEdit ? <ProjectButton orgId={orgId} projectId={projectId} /> : undefined}
    />
  )
}
```

## 10. Routes (TanStack Router)

Routes are glue: read params → navigation callbacks → render one feature component. No fetching, no `useTranslation`.

**File map (real `organization` tree)**

```
routes/organization/
├── route.tsx                    layout + auth guard     "/organization"
├── index.tsx                    page                    "/organization/"
├── create.tsx                   page                    "/organization/create"
└── $orgId/
    ├── route.tsx                dashboard layout        "/organization/$orgId"
    ├── index.tsx                page                    "/organization/$orgId/"
    ├── role.tsx                 redirect → roles        "/organization/$orgId/role"
    ├── users.tsx                leaf page               "/organization/$orgId/users"
    ├── roles/
    │   ├── index.tsx            list                    "/organization/$orgId/roles/"
    │   └── $roleId.tsx          details                 "/organization/$orgId/roles/$roleId"
    └── settings/
        ├── route.tsx            nested layout           "/organization/$orgId/settings"
        └── index.tsx            page                    "/organization/$orgId/settings/"
```

**The string in `createFileRoute(...)` must equal the file location**; `index.tsx` gets a trailing `/`. File kinds: `route.tsx` = layout (renders `<Outlet/>`), `index.tsx` = the folder's page, `$param.tsx` = dynamic child, `name.tsx` = leaf.

**List page** — `routes/organization/$orgId/projects/index.tsx`

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ProjectList } from "@/features/project-module"

export const Route = createFileRoute("/organization/$orgId/projects/")({
  component: ProjectsPage,
})

function ProjectsPage() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <ProjectList
      orgId={orgId}
      onViewProject={(projectId) =>
        navigate({ to: "/organization/$orgId/projects/$projectId", params: { orgId, projectId } })
      }
    />
  )
}
```

**Details page** — `…/projects/$projectId.tsx`

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ProjectDetails } from "@/features/project-module"

export const Route = createFileRoute("/organization/$orgId/projects/$projectId")({
  component: ProjectDetailsPage,
})

function ProjectDetailsPage() {
  const { orgId, projectId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <ProjectDetails
      orgId={orgId}
      projectId={projectId}
      onBack={() => navigate({ to: "/organization/$orgId/projects", params: { orgId } })}
    />
  )
}
```

**Redirect alias** (singular → plural) — `…/$orgId/project.tsx`

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/organization/$orgId/project")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/organization/$orgId/projects", params: { orgId: params.orgId } })
  },
})
```

**Layout** — `route.tsx`

```tsx
import { Outlet, createFileRoute } from "@tanstack/react-router"
import { SomeLayout } from "@/features/some-feature"

export const Route = createFileRoute("/organization/$orgId/settings")({ component: SettingsRoute })

function SettingsRoute() {
  const { orgId } = Route.useParams()
  return <SomeLayout orgId={orgId}><Outlet /></SomeLayout>
}
```

Layout opt-out (settings has its own layout): in `$orgId/route.tsx`, ``useLocation().pathname.startsWith(`/organization/${orgId}/settings`)`` → return a bare `<Outlet />`.

**Auth guard** — only in the top layout (`organization/route.tsx`); children never repeat it.

```tsx
function OrganizationLayout() {
  const { data, isLoading } = useAuthenticatedHandler()
  if (isLoading) return <LoadingPage />
  if (!data?.success) return <Navigate to={ROUTES.auth.index} replace />
  return <div className="flex h-screen flex-col bg-muted"><Outlet /></div>
}
```

Use `ROUTES` from `@/features/routes` for well-known app paths.

**Search params**

```tsx
type ProjectsSearch = { archived?: boolean }

export const Route = createFileRoute("/organization/$orgId/projects/")({
  validateSearch: (search: Record<string, unknown>): ProjectsSearch => ({
    archived: search.archived === true || search.archived === "true",
  }),
  component: ProjectsPage,
})
// read:  const { archived } = Route.useSearch()
// write: navigate({ to: "/organization", search: { all: true } })
```

**Standalone page with navbar** (create/index pages)

```tsx
<>
  <Navbar
    start={<><HomeButton /><DashboardButton /></>}
    end={<><UserButton /><ModeSwitcherBtn /><LanguageSwitcherButton /></>}
  />
  <div className="flex-1 overflow-auto p-6 md:p-8">
    <CreateOrganization onSuccess={(org) => { void navigate({ to: "/organization/$orgId", params: { orgId: org.id } }) }} />
  </div>
</>
```

Rules: typed `to` + `params`; `void navigate(...)` for fire-and-forget; redirect-on-mount uses `navigate({ …, replace: true })` in `useEffect` and `return null` meanwhile; add the nav/sidebar entry where the layout defines items (`OrgDashboardLayout` ⚠).

## 11. Locales (en + ar) & RTL

Two kinds of strings, **one namespace** per module (`useTranslation("project")`):

| Source | Holds |
|---|---|
| Contracts locale `packages/contracts/src/<module>/locales/{en,ar}.json` ⚠ | `errors.<CODE>`, `labels.*`, `msgs.<CODE>` — server messages + shared vocabulary |
| Web UI strings: per-namespace files `en/<namespace>.json` and `ar/<namespace>.json` ⚠ (confirm the root folder and how they merge with the contracts locale); shared strings (e.g. `combobox.*`) live in the `common` namespace — never duplicate them per module | `list.*`, `create.*`, `update.*`, `details.*`, `table.*`, `fields.*`, `actions.*`, `empty.*`, `pagination.*`, `delete.*`, `type.*` |

**Always add keys to both `en` and `ar`** with identical key sets.

**Key map used by the containers above**

```json
{
  "actions":  { "create": "New project", "edit": "Edit", "view": "View", "delete": "Delete", "cancel": "Cancel" },
  "create":   { "title": "Create project", "description": "…", "submitLabel": "Create", "submittingLabel": "Creating…" },
  "update":   { "title": "Edit project",   "description": "…", "submitLabel": "Save",   "submittingLabel": "Saving…" },
  "fields": {
    "name":        { "label": "Name",        "placeholder": "e.g. Website redesign" },
    "description": { "label": "Description", "placeholder": "Optional" }
  },
  "list": {
    "title": "Projects", "description": "…",
    "tabs":   { "aria": "Filter by status", "all": "All", "draft": "Draft", "active": "Active", "archived": "Archived" },
    "search": { "placeholder": "Search projects", "clear": "Clear search" }
  },
  "table":  { "name": "Name", "status": "Status", "members": "Members", "actions": "Actions", "actionsFor": "Actions for {{name}}" },
  "empty":  { "title": "No projects yet", "description": "Create your first project." },
  "pagination": {
    "nav": "Pagination", "previous": "Previous", "next": "Next", "rowsPerPage": "Rows per page",
    "summary": "{{from}}–{{to}} of {{total}}", "pageOf": "Page {{page}} of {{pageCount}}", "goTo": "Go to page {{page}}"
  },
  "delete":  { "title": "Delete project?", "description": "“{{name}}” will be permanently deleted." },
  "details": { "back": "Back to projects", "createdAt": "Created", "updatedAt": "Updated" },
  "labels":  { "draft": "Draft", "active": "Active", "archived": "Archived" },
  "form":    { "<entity>": { "createNew": "Create new <entity>" } }   // only for async combobox fields (§17)
}
```

Usage:

```tsx
const { t, i18n } = useTranslation("project")
t("list.title")
t("delete.description", { name })                          // interpolation {{name}}, never concatenate
t(`list.tabs.${scope}`)                                    // dynamic key OK for a closed set
t(`labels.${status}`, { defaultValue: status })            // open set: always defaultValue
new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(date)   // in the container
```

Server errors: display `parseApiError(e).message` (already localized by the backend). Never map error codes in the web.

Arabic: translate meaning, keep product nouns consistent with the existing `ar.json`; keep placeholders `{{x}}` intact. Layout: logical utilities only; flip arrows with `rtl:rotate-180`.

Before finishing, diff the key sets of `en` and `ar` (a missing key shows the raw key in one language).

## 12. Permissions in the web

- Key format `"<action>:<resource>"`, kebab-case: `hasPermission(snapshot, "update:organization-user")`. A malformed key **throws** (by design); fix the typo.
- Semantics: statements `{ effect, resource, action, resourceId }`, `*` wildcards, **deny beats allow**, no match = denied; owner = full access; non-members = none. A statement scoped to one id only matches checks for that id.
- Web pattern: `useXAbilities(orgId)` in `<name>-api.ts` (§5) → `{ canCreate, canUpdate, canDelete }`; gate buttons and row actions:

```tsx
actions={abilities.canCreate ? <ProjectButton orgId={orgId} /> : null}   // toolbar
if (abilities.canDelete) actions.push({ id: "delete", … })                // row action
```

- System-owned records (`isSystem`) are read-only: hide edit/delete in the UI (`role-module` does).
- A business rule the server enforces (can't delete role with members) is mirrored with `disabled: …` on the action, never by hiding silently.
- The role picker only shows plain `allow <action> on <resource> *` statements and **preserves** wildcards/denies/scoped ones untouched (`isPickableStatement`, `countHiddenStatements`). Don't "clean" statements you can't display.
- New backend resource ⇒ add `labels.resources.<resource>` and any new `labels.actions.<action>` in **both** locales, otherwise the role editor shows raw tokens.
- Open decision (don't pre-empt): backend permission checks currently live in services, not route middleware.

## 13. Styling & accessibility

- Tokens: `text-foreground`, `text-muted-foreground`, `bg-card text-card-foreground`, `border-border`, `bg-muted`, `text-destructive`. No hex/rgb, no `text-gray-500`.
- Empty state box: `rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground`.
- Numbers in tables: `tabular-nums`. Headings: `text-xl font-semibold text-foreground`.
- RTL: `ps-6`, `pe-1`, `ms-*`, `me-*`, `text-start`; never `pl/pr/ml/mr/left/right` for directional spacing.
- Loading: `Skeleton` + `aria-busy` on the wrapper. Errors: `<p role="alert" className="text-sm text-destructive">`.
- Icon-only buttons need `aria-label`; decorative icons `aria-hidden`. Dialogs always have a title + description (`sr-only` if the form already shows its own).
- Responsive: tables below `md` render `renderMobileCard`; dialogs `max-h-[90dvh] overflow-y-auto sm:max-w-lg`.
- `fieldset` + `legend` for grouped inputs (see `RolePermissionsField`).

## 14. Testing

- Vitest, file beside the source: `lib/foo.ts` → `lib/foo.test.ts`; `project-api.ts` → `project-api.test.ts`.
- Test: every pure function in `lib/`, every `normalize*`, any selection/toggle logic (incl. "doesn't touch statements it can't show", "no duplicates when selecting a partly selected group").
- Style: `describe` per function, `it("does X when Y")`, small literal fixtures, `toEqual` for shapes.
- Don't test hooks that only forward to `@/api`; test the normalizers they call.

## 15. Commands & definition of done

Commands ⚠ (fill in once):

| Purpose | Command |
|---|---|
| Install | `<pnpm install>` |
| Typecheck | `<pnpm typecheck>` |
| Lint | `<pnpm lint>` |
| Tests | `<pnpm test>` · one file: `<pnpm vitest run path>` |
| Regenerate API client | `<pnpm … api:generate>` |
| Route tree | regenerated by the web dev server, or `<tsr generate>` |

Definition of done:

- [ ] `@/api` imported only in `<name>-api.ts`; no `useTranslation`/`useNavigate`/api hooks in pure views
- [ ] Mutations invalidate list key (+ detail key on update)
- [ ] Buttons/actions gated by abilities; business-rule disables mirrored
- [ ] Delete uses `ConfirmDialog`, shows the server error, closes only on success
- [ ] Loading skeleton + `aria-busy`; error `role="alert"`; empty state
- [ ] Barrels at every folder; module root exports no API hooks
- [ ] Route files created, path strings match locations, back/after-success navigation done in the route
- [ ] Strings in `en` **and** `ar`, no hard-coded text
- [ ] Tests for lib + normalizers; typecheck, lint, tests green
- [ ] Checked in Arabic/RTL and at mobile width

## 16. Anti-patterns

| ❌ Don't | ✅ Do |
|---|---|
| `useTranslation` inside a pure form/view | pass a typed `copy` prop built by a container or `use-*-copy` hook |
| `useNavigate` inside a feature | call `onSuccess` / `onBack` / `onViewX` |
| Import `@/api` in a list/form/details file | add a hook to `<name>-api.ts` |
| Deep-import another feature's internals | import from its `index.ts`, or extract the shared piece |
| Export API hooks from the module root | export components + types only |
| `search` `""` sent to the API | `search: search || undefined` |
| New `[]` per render as default data | module-level `const NO_ITEMS = []` |
| `description: ""` posted to the server | `values.description?.trim() \|\| null` |
| Map error codes to text in the web | show `parseApiError(e).message` |
| Hide a disabled-by-rule action | keep it visible with `disabled: true` |
| `pl-6`, `text-left`, `text-gray-500` | `ps-6`, `text-start`, `text-muted-foreground` |
| Hard-coded "coming soon" in a route (`users.tsx` does this) | `t("…")` with en + ar keys |
| Edit `routeTree.gen.ts` | change the route file; it regenerates |
| `SelectField` with a preloaded array for a long/growing entity list | `AsyncComboboxField` + `use<Entity>Options` (§17) |
| `search: ""` sent to an options endpoint | omit empty `search` (`useCursorOptions` already does) |

---

## 17. Pattern: async combobox field (searchable, paginated, server-backed select)

**Use when** a form must pick an existing entity that can grow long (role, label, member, customer, project, category…), or someone says "searchable select", "combobox", "async select", "dropdown with search / pagination / infinite scroll", "select or create new", "replace SelectField", "options endpoint" or "lookup endpoint".
**Don't use** for short fixed lists (under ~20 stable options → keep `SelectField`) or multi-select (not built yet: tell the user, don't fake it with several single fields).

It puts a searchable, infinitely-scrolling picker with an optional "Create new" footer into a form, backed by a cursor-paginated `*-options` endpoint that returns only `{ id, name }`. Each layer is generic on purpose: a new module adds **one endpoint, one hook and one field** and never edits the shared code. If you find yourself editing the shared pieces to make one module work, stop and reconsider.

### 17.1 Reusable pieces (find them, reuse them, never copy them)

| Piece | Layer | What it gives you |
|---|---|---|
| `OptionListQuerySchema`, `OptionListResponseSchema`, `OptionDtoSchema` | contracts | `search`, `cursor`, `limit` in; `{ items: {id, name}[], nextCursor }` out |
| `decodeCursor`, `toCursorPage` | API utils (`cursor.ts`) | opaque keyset cursor and the "fetch limit + 1" paging |
| `useCursorOptions` | web lib (`@/lib/options/use-cursor-options`) | debounce, infinite query, per-search cache, lazy fetch |
| `AsyncComboboxField` (wraps `AsyncCombobox`) | `@workspace/ui/blocks/form` | the RHF field: search box, infinite scroll, "Create new" footer |
| `useCreateOption` | `@workspace/ui/blocks/form` | glue from the footer button to a create dialog |
| `useAsyncComboboxCopy` | web lib | shared loading / empty / error strings |

Reference implementation: **role options**. Read it before writing anything and mirror its style: `role-options.route.ts`, `listOptions` in the role repository and service, `useRoleOptions` in `role-api.ts`, `create-invitation-form.tsx`, `create-invitation.tsx`. Worked example for another entity: §17.9.

### 17.2 Before writing code

1. Locate the pieces: `grep -rl "AsyncComboboxField\|useCursorOptions\|toCursorPage\|OptionListQuerySchema" apps packages`. If one is missing, say so and stop; do not write a one-off combobox.
2. Decide the shape (variants in §17.8):
   - what `name` is (a column, or an expression such as first + last name) and the sort order. The sort key must be unique, so **always end it with `id`**.
   - which rows are visible (tenant scope, system plus custom rows, archived rows) — copy the condition the module's own `list` uses.
   - which permission guards it (the module's existing guard style, normally `requirePermission("read:<entity>")`).
   - whether the form needs "Create new", and if so which permission and plan feature gates it.

### 17.3 Steps

1. **Server** — add `listOptions` to the module's repository and service, and a `GET /organizations/{orgId}/<entity>-options` route with `operationId: "list<Entity>Options"`. Templates: §17.6. Register the router next to the module's list route, then regenerate the API client.
2. **Web api hook** — add `use<Entity>Options(orgId)` to the feature's `<feature>-api.ts` (the one file that knows the generated client). Template: §17.7.
3. **Form** — swap `SelectField` for `AsyncComboboxField`. The **pure form** takes `source`, `comboboxCopy` and an optional `createAction` as props and knows nothing about the API; the **composition component** calls `use<Entity>Options` and `useAsyncComboboxCopy` and passes them down. Template: §17.7.
4. **Create new (optional)** — `useCreateOption` plus the entity's existing create dialog. Hide the button when the user lacks the create permission or the plan lacks the feature. Make the entity's create mutation invalidate the options cache prefix so the new row appears.
5. **Translations** — add keys for **both English and Arabic**: the "Create new <entity>" label in the feature's namespace, and nothing else (loading / empty / error strings are shared and already exist). Keep the key structure identical in both locale files.
6. **Verify** — run the checklist in §17.5.

### 17.4 Rules that are easy to get wrong (and why)

- **Never send `search=""`.** The contract rejects an empty string, and `useCursorOptions` already omits it; keep custom `fetchPage` functions doing the same.
- Name the path `/<entity>-options`, not `/<entities>/options`: a `/{id}` route registered earlier would capture it.
- Query `limit + 1` rows and pass them to `toCursorPage`; the extra row is how it knows another page exists.
- Return only `{ id, name }` from the service even if the row has more. Pickers must stay cheap and must not leak columns.
- Extra filters (status, scope) go in the query schema, in `fetchPage`, **and** in the `queryKey` prefix passed to `useCursorOptions`; otherwise two different filters share one cache entry.
- Edit forms: pass `initialOption={{ id, name }}` (from the entity being edited) so the label shows before the list loads. Without it the field shows nothing for an existing id until the list is opened.
- **Do not fetch on mount.** `useCursorOptions` waits for the first open; don't add `enabled: true` overrides.
- Form values stay plain id strings. Do not store option objects in react-hook-form.
- Keep the pure form pure: no `useQuery`, no `t()`, no navigation inside it (same rule as §2).

### 17.5 Done checklist

- [ ] Route appears in OpenAPI and the client exposes `list<Entity>Options` and `getList<Entity>OptionsQueryKey`
- [ ] Repository query uses the same visibility condition as `list`; sort key ends in `id`
- [ ] Service returns `{ id, name }` only and `nextCursor` is `null` on the last page
- [ ] Hook passes `signal`, omits empty `search`, and uses the generated key as the cache prefix
- [ ] Form field replaced; `isPending` no longer waits on a list preload
- [ ] Create flow: button hidden without permission/plan; mutation invalidates the options prefix; new row is selected
- [ ] English and Arabic keys added with matching structure
- [ ] Typecheck passes; manual test: open, type, scroll to load more, clear the box, pick, create new, edit-form label

### 17.6 Server templates

Placeholders: `<entity>` kebab-case, `<Entity>` PascalCase, `<table>` the Drizzle table, `<ENTITY>` error-code prefix. Role options is the real, working instance of everything below.

**Repository (`<entity>.repository.ts`, beside `list`)**

```ts
async listOptions(
  orgId: string,
  f: { search?: string; after: { name: string; id: string } | null; limit: number },
  tx?: Tx
): Promise<{ id: string; name: string }[]> {
  const conditions: SQL[] = [/* the same visibility / tenant condition `list` uses */]
  if (f.search) conditions.push(ilike(<table>.name, `%${escapeLike(f.search)}%`))
  if (f.after) {
    // Row comparison = "everything after this (name, id)", matching the ORDER BY below exactly.
    conditions.push(
      sql`(${<table>.name}, ${<table>.id}) > (${f.after.name}::text, ${f.after.id}::uuid)`
    )
  }
  return exec(tx)
    .select({ id: <table>.id, name: <table>.name })
    .from(<table>)
    .where(and(...conditions))
    .orderBy(asc(<table>.name), asc(<table>.id))
    .limit(f.limit)
},
```

**Service (`<entity>.service.ts`)**

```ts
import type { OptionListQuery, OptionListResponse } from "@avuny/contracts"
import { decodeCursor, toCursorPage } from "@avuny/utils" // wherever cursor.ts lives

const <entity>OptionCursorSchema = z.object({ name: z.string(), id: z.string() })

async listOptions(
  orgId: string,
  query: OptionListQuery
): Promise<Result<OptionListResponse, Code>> {
  const rows = await repo.listOptions(orgId, {
    search: query.search,
    after: decodeCursor(query.cursor, <entity>OptionCursorSchema),
    limit: query.limit + 1,
  })
  const page = toCursorPage(rows, query.limit, (row) => ({ name: row.name, id: row.id }))
  return ok({
    data: {
      items: page.items.map(({ id, name }) => ({ id, name })),
      nextCursor: page.nextCursor,
    },
    msg: "<Entity> options retrieved successfully",
  })
},
```

A bad or stale cursor decodes to `null` and restarts at page one; do not add an error code for it.

**Route (`routes/<entity>-options.route.ts`)** — copy `role-options.route.ts` and change only: the service import, `path` (`/organizations/{orgId}/<entity>-options`), `operationId` (`list<Entity>Options`), `tags`, `summary`, the permission string, the 403 error code, and the service call. Keep `OptionListQuerySchema` and `OptionListResponseSchema` as they are. Then register the router next to the module's list route, regenerate the API client (the repo's orval script), and confirm `list<Entity>Options` and `getList<Entity>OptionsQueryKey` exist in the generated client.

### 17.7 Web templates

**1. API hook (`apps/web/src/features/<feature>/<feature>-api.ts`)**

```ts
import { getList<Entity>OptionsQueryKey, list<Entity>Options } from "@/api" // generated by orval
import { useCursorOptions } from "@/lib/options/use-cursor-options"

export function use<Entity>Options(orgId: string) {
  return useCursorOptions({
    queryKey: getList<Entity>OptionsQueryKey(orgId),
    fetchPage: async ({ cursor, search, limit, signal }) =>
      (await list<Entity>Options(orgId, { cursor, search, limit }, { signal })).data,
    enabled: Boolean(orgId),
  })
}
```

Extra filter: add it to the call params **and** to the key, e.g. `queryKey: [...getList<Entity>OptionsQueryKey(orgId), { status }]`.

**2. Pure form (`<x>-form.tsx`)** — replace the `SelectField` and its `options` prop:

```tsx
import {
  AsyncComboboxField,
  type AsyncComboboxCopy,
  type AsyncOptionsSource,
  type ComboboxCreateAction,
} from "@workspace/ui/blocks/form"

type Props = {
  // …existing props, minus the old options array
  <entity>Combobox: AsyncComboboxCopy
  <entity>Source: AsyncOptionsSource
  <entity>CreateAction?: ComboboxCreateAction // omit to hide "Create new"
  <entity>InitialOption?: { id: string; name: string } | null // edit forms only
}

<AsyncComboboxField
  control={form.control}
  name="<entity>Id"
  copy={copy.<entity>}
  comboboxCopy={<entity>Combobox}
  source={<entity>Source}
  initialOption={<entity>InitialOption}
  createAction={<entity>CreateAction}
  disabled={isPending}
  placeholder={copy.<entity>.placeholder}
/>
```

**3. Composition component**

```tsx
const { t } = useTranslation("<feature-namespace>")
const <entity>Source = use<Entity>Options(orgId)
const <entity>Combobox = useAsyncComboboxCopy()
const create<Entity> = useCreateOption((created: <Entity>Dto) => ({ id: created.id, name: created.name }))

<XForm
  <entity>Source={<entity>Source}
  <entity>Combobox={<entity>Combobox}
  <entity>CreateAction={canCreate<Entity> ? create<Entity>.action(t("form.<entity>.createNew")) : undefined}
  …
/>
{canCreate<Entity> && (
  <Create<Entity>Dialog
    orgId={orgId}
    open={create<Entity>.open}
    onOpenChange={create<Entity>.setOpen}
    defaultName={create<Entity>.search}   // optional prefill, if the dialog supports it
    onSuccess={create<Entity>.onCreated}  // must receive the created entity
  />
)}
```

Drop `canCreate<Entity>` and the dialog entirely when the form does not offer "Create new". Remove any `isLoading` wait for the old preloaded options from `isPending`; the list now loads lazily. If the create UI is a full page rather than a dialog, call `navigate` inside a hand-written `createAction.onClick` instead of using `useCreateOption` (the navigation still lives in the composition component, never in the pure form).

**4. Cache invalidation** (the entity's create / rename / delete mutations):

```ts
queryClient.invalidateQueries({ queryKey: getList<Entity>OptionsQueryKey(orgId) })
```

The prefix covers every search term and page.

**5. Translations (English and Arabic, same structure)**

```json
// en/<feature-namespace>.json
{ "form": { "<entity>": { "createNew": "Create new <entity>" } } }
// ar/<feature-namespace>.json
{ "form": { "<entity>": { "createNew": "<Arabic: إنشاء … جديد>" } } }
```

Merge into the existing `form.<entity>` object if it exists. The shared `combobox.*` strings already exist in the `common` namespace; do not duplicate them per module.

### 17.8 Variants

| Situation | What to change |
|---|---|
| `name` is not a column (full name, email fallback) | Define ``const name = sql<string>`…` `` once; use it in `select`, `ilike`, `orderBy` **and** the row comparison, so all four agree. |
| Group rows (system before custom, active before archived) | Add the group expression as the **first** sort key, put it in the cursor (see the role `custom` flag), and in the row comparison. |
| Case-insensitive ordering | Order and compare on `lower(name)`; carry that lowered value in the cursor, then `id`. |
| Ids are not uuid | Change the `::uuid` cast in the row comparison to the real type; the contract's `id` is already a plain string. |
| Extra filter (status, scope, parent id) | `OptionListQuerySchema.extend({ … })` for that route only; add it to the repository conditions, to `fetchPage` params, and to the `queryKey` prefix. |
| Global (not per-organization) list | Drop the `orgId` path param and the tenant condition; keep everything else. Still guard it with a permission. |
| Rows the user must always be able to pick (e.g. their own role) | The endpoint permission should match what the form needs, which may be broader than `read:<entity>`; use the module's existing way to express "any of these". |
| Very large table (100k+ rows) | `ilike '%x%'` cannot use a btree index. Add a `pg_trgm` GIN index on the name column. |
| Multi-select | Not built. Tell the user; do not fake it with several single fields. |
| Short fixed list (under ~20 stable options) | Keep `SelectField`; this pattern costs more than it gives. |

**Cursor rule of thumb:** the cursor must contain every value in the `ORDER BY`, in the same order, and the repository's row comparison must list the same expressions in the same order and direction. Mixed ASC/DESC keys cannot use a single row comparison; split into an OR condition or make the keys all ascending.

### 17.9 Worked example: customer picker on the create-invoice form

Illustrative module (swap names for the real entity). Extra wrinkle on top of role options: archived customers are hidden from the picker.

| Placeholder | Value here |
|---|---|
| entity / Entity / table | `customer` / `Customer` / `customers` |
| endpoint | `GET /organizations/{orgId}/customer-options`, `operationId: "listCustomerOptions"` |
| guard | `requirePermission("read:customer")` |
| "Create new" gate | `create:customer` (and the plan feature, if the plan limits customers) |
| form / field | create-invoice form / `customerId` |
| namespaces | `invoice` (label), `common` (shared combobox strings, already exist) |

**Server — repository (`customer.repository.ts`, beside `list`).** The visibility condition is copied from `list`, including the archived filter:

```ts
async listOptions(
  orgId: string,
  f: { search?: string; after: { name: string; id: string } | null; limit: number },
  tx?: Tx
): Promise<{ id: string; name: string }[]> {
  const conditions: SQL[] = [eq(customers.orgId, orgId), isNull(customers.archivedAt)]
  if (f.search) conditions.push(ilike(customers.name, `%${escapeLike(f.search)}%`))
  if (f.after) {
    conditions.push(
      sql`(${customers.name}, ${customers.id}) > (${f.after.name}::text, ${f.after.id}::uuid)`
    )
  }
  return exec(tx)
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .where(and(...conditions))
    .orderBy(asc(customers.name), asc(customers.id))
    .limit(f.limit)
},
```

**Service** (`customer.service.ts`): same as the §17.6 template with `customerOptionCursorSchema` and the message "Customer options retrieved successfully".

**Route** (`routes/customer-options.route.ts`): copy `role-options.route.ts`, change the service call, `path`, `operationId`, `tags: ["customer"]`, `summary`, `requirePermission("read:customer")` and the 403 error code (`CUSTOMER_PERMISSION_DENIED`). Register it next to the customer list route, regenerate the client.

**Web — `customer-api.ts`** (feature `customer`):

```ts
import { getListCustomerOptionsQueryKey, listCustomerOptions } from "@/api"
import { useCursorOptions } from "@/lib/options/use-cursor-options"

export function useCustomerOptions(orgId: string) {
  return useCursorOptions({
    queryKey: getListCustomerOptionsQueryKey(orgId),
    fetchPage: async ({ cursor, search, limit, signal }) =>
      (await listCustomerOptions(orgId, { cursor, search, limit }, { signal })).data,
    enabled: Boolean(orgId),
  })
}
```

**`create-invoice-form.tsx` (pure form)** — drop the `customerOptions` array prop, add the three props below and swap the field:

```tsx
type Props = {
  // …existing props
  customerCombobox: AsyncComboboxCopy
  customerSource: AsyncOptionsSource
  customerCreateAction?: ComboboxCreateAction
  customerInitialOption?: { id: string; name: string } | null // edit form only
}

<AsyncComboboxField
  control={form.control}
  name="customerId"
  copy={copy.customer}
  comboboxCopy={customerCombobox}
  source={customerSource}
  initialOption={customerInitialOption}
  createAction={customerCreateAction}
  disabled={isPending}
  placeholder={copy.customer.placeholder}
/>
```

**`create-invoice.tsx` (composition)**

```tsx
const { t } = useTranslation("invoice")
const customerSource = useCustomerOptions(orgId)
const customerCombobox = useAsyncComboboxCopy()
const createCustomer = useCreateOption((c: CustomerDto) => ({ id: c.id, name: c.name }))

<CreateInvoiceForm
  customerSource={customerSource}
  customerCombobox={customerCombobox}
  customerCreateAction={canCreateCustomer ? createCustomer.action(t("form.customer.createNew")) : undefined}
  …
/>
{canCreateCustomer && (
  <CustomerDialog
    orgId={orgId}
    open={createCustomer.open}
    onOpenChange={createCustomer.setOpen}
    defaultName={createCustomer.search}
    onSuccess={createCustomer.onCreated}
  />
)}
```

`canCreateCustomer` comes from the same permission snapshot the invoice screen already uses (§12). The edit form passes `customerInitialOption={invoice.customer}` so the current name shows before the list loads.

Customer create / update / archive mutations invalidate the options prefix:

```ts
queryClient.invalidateQueries({ queryKey: getListCustomerOptionsQueryKey(orgId) })
```

**Translations**

```json
// en/invoice.json  (merge into form.customer)
{ "form": { "customer": { "createNew": "Create new customer" } } }
// ar/invoice.json
{ "form": { "customer": { "createNew": "إنشاء عميل جديد" } } }
```

**Manual test:** open the list (first page loads, nothing loaded before), type a partial name (debounced, results narrow), clear the box (full list returns at once), scroll to the end (next page loads), pick a customer, press "Create new customer" (dialog opens prefilled, new customer ends up selected), open an existing invoice (name shows immediately), check an archived customer never appears.