# Templates: details (view + container)

## details/project-details-view.tsx — PURE

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
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />   {/* flips in RTL */}
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

## details/project-details.tsx — CONTAINER

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
