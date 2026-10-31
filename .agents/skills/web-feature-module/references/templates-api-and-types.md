# Templates: types.ts and project-api.ts

## types.ts

```ts
import type {
  CreateProjectInput,
  ProjectDto,
  ProjectListItemDto,
  UpdateProjectInput,
} from "@avuny/contracts"

export type { CreateProjectInput, ProjectDto, ProjectListItemDto, UpdateProjectInput }

// UI-only types live here, never in the contracts.
export type ProjectScope = "all" | "draft" | "active" | "archived"
```

## project-api.ts

Why this file exists: the generated client's shape may change; this is the one place to fix. It also normalizes optional/nullable fields so the rest of the UI sees clean values.

```ts
/**
 * The only file in this module that knows the shape of the generated API
 * client (@/api). Everything else consumes the normalized values returned here,
 * so if a hook name or response shape differs, this is the one place to fix.
 */
import { useMemo } from "react"
import { keepPreviousData, useQueryClient } from "@tanstack/react-query"
import { hasPermission, type PermissionSnapshot } from "@avuny/contracts"

import {
  getGetProjectQueryKey,
  getListProjectsQueryKey,
  useCreateProject,
  useDeleteProject,
  useGetMyPermissions,
  useGetProject,
  useListProjects,
  useUpdateProject,
} from "@/api"

import type { ProjectDto, ProjectListItemDto, ProjectScope } from "./types"

// ⚠ normalizeStatement currently lives in role-module/role-api.ts. Do not deep-import
// another feature's internals: extract it to a shared place (ask maintainers) or, until
// then, keep a private copy here:
function normalizeStatement(s: { effect?: string; resource: string; action: string; resourceId?: string }) {
  return {
    effect: s.effect === "deny" ? ("deny" as const) : ("allow" as const),
    resource: s.resource,
    action: s.action,
    resourceId: s.resourceId ?? "*",
  }
}

const NO_PROJECTS: ProjectListItemDto[] = []   // stable empty refs: no new [] per render

/* ------------------------------ normalizers ------------------------------ */
export function normalizeProject(data: {
  id: string; orgId: string; name: string
  description?: string | null
  status: string
  createdAt: string; updatedAt: string
}): ProjectDto {
  return {
    ...data,
    description: data.description ?? null,
    status: data.status as ProjectDto["status"],
  }
}

/* -------------------------------- queries -------------------------------- */
export type ProjectListParams = {
  page: number            // 1-based
  pageSize: number
  scope: ProjectScope
  search: string
}

export function useProjectList(orgId: string, { page, pageSize, scope, search }: ProjectListParams) {
  const query = useListProjects(
    orgId,
    {
      page,
      pageSize,
      status: scope === "all" ? undefined : scope,
      search: search || undefined,           // "" must not reach the server
    },
    { query: { placeholderData: keepPreviousData } }   // no flash between pages
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
  return useUpdateProject({
    mutation: { onSuccess: (_res, vars) => invalidate(vars.projectId) },
  })
}

/** `mutateAsync({ orgId, projectId })` */
export function useDeleteProjectMutation(orgId: string) {
  const invalidate = useInvalidateProjects(orgId)
  return useDeleteProject({ mutation: { onSuccess: () => invalidate() } })
}
```

Notes: `useGetMyPermissions` and `normalizeStatement` already exist in `role-module/role-api.ts`. Don't copy them blindly into every module — if two modules need abilities, move the shared pieces to a common spot (ask the maintainers) rather than diverging copies.

## project-api.test.ts

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

## lib/use-project-labels.ts

```ts
import { useCallback } from "react"
import { useTranslation } from "react-i18next"

/** Unknown tokens fall back to the raw value, so a new status never renders a missing-key string. */
export function useProjectLabels() {
  const { t } = useTranslation("project")
  const getStatusLabel = useCallback(
    (status: string) => t(`labels.${status}`, { defaultValue: status }),
    [t]
  )
  return { getStatusLabel }
}
```

## components/project-status-badge.tsx

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
