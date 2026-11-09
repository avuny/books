import { useState } from "react"

import { Skeleton } from "@workspace/ui/components/skeleton"
import { parseApiError } from "@workspace/ui/lib/api-error"

import {
  normalizeItemCategory,
  useItemCategory,
  useUpdateItemCategoryMutation,
} from "../item-category-api"
import type { ItemCategoryDto } from "../types"
import {
  UpdateItemCategoryForm,
  type UpdateItemCategoryFormValues,
} from "./update-item-category-form"
import { toUpdateItemCategoryInput } from "./item-category-form-schema"
import {
  useItemCategoryFormCopy,
  useItemCategoryParentPicker,
} from "./use-item-category-form-copy"

type UpdateItemCategoryProps = {
  orgId: string
  /** The list rows are loaded by id so the form always starts from fresh data. */
  categoryId: string
  onSuccess?: (category: ItemCategoryDto) => void
}

// Composition only: loads the category and its parent, wires strings + API into the pure form.
export function UpdateItemCategory({ orgId, categoryId, onSuccess }: UpdateItemCategoryProps) {
  const [serverError, setServerError] = useState<string | null>(null)

  const { category, isLoading, error } = useItemCategory(orgId, categoryId)
  // The DTO only carries the parent's id; look its name up so the picker can show it at once.
  const { category: parent, isLoading: parentLoading } = useItemCategory(
    orgId,
    category?.parentId
  )
  const updateMutation = useUpdateItemCategoryMutation(orgId)
  const copy = useItemCategoryFormCopy("update")
  const parentPicker = useItemCategoryParentPicker(
    orgId,
    parent ? { id: parent.id, name: parent.name } : null
  )

  // Called only when Zod validation passes (react-hook-form guards the fields).
  const handleSubmit = async (values: UpdateItemCategoryFormValues) => {
    setServerError(null)
    try {
      const response = await updateMutation.mutateAsync({
        orgId,
        categoryId,
        data: toUpdateItemCategoryInput(values),
      })
      onSuccess?.(normalizeItemCategory(response.data))
    } catch (e) {
      setServerError(parseApiError(e).message || null)
    }
  }

  if (isLoading || (category?.parentId && parentLoading)) {
    return (
      <div className="grid gap-4" aria-busy>
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    )
  }

  if (!category) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error ? parseApiError(error).message : null}
      </p>
    )
  }

  return (
    <UpdateItemCategoryForm
      copy={copy}
      parent={parentPicker}
      category={category}
      onSubmit={handleSubmit}
      isPending={updateMutation.isPending}
      errorMessage={serverError}
    />
  )
}
