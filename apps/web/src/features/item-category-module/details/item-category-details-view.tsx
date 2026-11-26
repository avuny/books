import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { ItemCategoryStatusBadge } from "../components"
import type { ItemCategoryDto } from "../types"

export type ItemCategoryDetailsViewCopy = {
  backLabel: string
  activeLabel: string
  inactiveLabel: string
  subCategoriesLabel: string
  itemsLabel: string
  createdLabel: string
  updatedLabel: string
  /** Explains why a category that is in use can only be deactivated. */
  inUseHint: string
}

export interface ItemCategoryDetailsViewProps {
  category: ItemCategoryDto | null
  isLoading: boolean
  /** Already localized. Shown instead of the category when loading failed. */
  errorMessage?: string | null
  copy: ItemCategoryDetailsViewCopy
  /** Already formatted for the current locale. */
  createdAt: string
  updatedAt: string
  onBack?: () => void
  /** Usually <ItemCategoryButton />; omit when the user can't edit. */
  editAction?: ReactNode
}

export function ItemCategoryDetailsView({
  category,
  isLoading,
  errorMessage,
  copy,
  createdAt,
  updatedAt,
  onBack,
  editAction,
}: ItemCategoryDetailsViewProps) {
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
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !category ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-foreground">
                  {category.name}
                </h1>
                <ItemCategoryStatusBadge
                  isActive={category.isActive}
                  activeLabel={copy.activeLabel}
                  inactiveLabel={copy.inactiveLabel}
                />
              </div>
              {category.description ? (
                <p className="text-sm text-muted-foreground">
                  {category.description}
                </p>
              ) : null}
            </div>
            {editAction}
          </div>

          {category.childCount > 0 || category.itemCount > 0 ? (
            <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              {copy.inUseHint}
            </p>
          ) : null}

          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">
                {copy.subCategoriesLabel}
              </dt>
              <dd className="text-foreground tabular-nums">
                {category.childCount}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {copy.itemsLabel}
              </dt>
              <dd className="text-foreground tabular-nums">
                {category.itemCount}
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
        </>
      )}
    </div>
  )
}
