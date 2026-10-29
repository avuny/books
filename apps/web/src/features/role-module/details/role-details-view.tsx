import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { RoleTypeBadge } from "../components"
import type { StatementGroup } from "../lib"
import type { RoleDto } from "../types"
import {
  RolePermissionsSummary,
  type RolePermissionsSummaryCopy,
} from "./role-permissions-summary"

export type RoleDetailsViewCopy = {
  backLabel: string
  systemLabel: string
  customLabel: string
  /** Explains why a system role has no edit button. */
  systemHint: string
  membersLabel: string
  createdLabel: string
  updatedLabel: string
  permissionsTitle: string
  summary: RolePermissionsSummaryCopy
}

export interface RoleDetailsViewProps {
  role: RoleDto | null
  /** Display name (system role names are translated by the caller). */
  roleName: string
  isLoading: boolean
  /** Already localized. Shown instead of the role when loading failed. */
  errorMessage?: string | null
  copy: RoleDetailsViewCopy
  groups: StatementGroup[]
  getResourceLabel: (resource: string) => string
  getActionLabel: (action: string) => string
  /** Already formatted for the current locale. */
  createdAt: string
  updatedAt: string
  onBack?: () => void
  /** Usually <RoleButton />; omit when the user can't edit. */
  editAction?: ReactNode
}

export function RoleDetailsView({
  role,
  roleName,
  isLoading,
  errorMessage,
  copy,
  groups,
  getResourceLabel,
  getActionLabel,
  createdAt,
  updatedAt,
  onBack,
  editAction,
}: RoleDetailsViewProps) {
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
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : !role ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-foreground">
                  {roleName}
                </h1>
                <RoleTypeBadge
                  isSystem={role.isSystem}
                  systemLabel={copy.systemLabel}
                  customLabel={copy.customLabel}
                />
              </div>
              {role.description ? (
                <p className="text-sm text-muted-foreground">
                  {role.description}
                </p>
              ) : null}
            </div>
            {editAction}
          </div>

          {role.isSystem ? (
            <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              {copy.systemHint}
            </p>
          ) : null}

          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">
                {copy.membersLabel}
              </dt>
              <dd className="text-foreground tabular-nums">
                {role.memberCount}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {copy.createdLabel}
              </dt>
              <dd className="text-foreground">{createdAt}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {copy.updatedLabel}
              </dt>
              <dd className="text-foreground">{updatedAt}</dd>
            </div>
          </dl>

          <section className="grid gap-3">
            <h2 className="text-sm font-medium text-foreground">
              {copy.permissionsTitle}
            </h2>
            <RolePermissionsSummary
              groups={groups}
              copy={copy.summary}
              getResourceLabel={getResourceLabel}
              getActionLabel={getActionLabel}
            />
          </section>
        </>
      )}
    </div>
  )
}
