import { useState } from "react"

import { Skeleton } from "@workspace/ui/components/skeleton"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { unitLabel } from "../../unit-module"
import { normalizeItem, useItem, useUpdateItemMutation } from "../item-api"
import type { ItemDto } from "../types"
import { toUpdateItemInput } from "./item-form-schema"
import { UpdateItemForm, type UpdateItemFormValues } from "./update-item-form"
import { useItemFormCopy, useValuationOptions } from "./use-item-form-copy"
import { useItemPickers } from "./use-item-pickers"

type UpdateItemProps = {
  orgId: string
  /** The list rows are partial, so the item is loaded by id. */
  itemId: string
  onSuccess?: (item: ItemDto) => void
}

// Composition only: loads the item, wires strings + API behavior into the pure form.
export function UpdateItem({ orgId, itemId, onSuccess }: UpdateItemProps) {
  const [serverError, setServerError] = useState<string | null>(null)

  const { item, isLoading, error } = useItem(orgId, itemId)
  const updateMutation = useUpdateItemMutation(orgId)
  const copy = useItemFormCopy("update")
  const valuationOptions = useValuationOptions()
  // The current category and base unit show their names before the lists are opened.
  const { pickers, createCategoryDialog } = useItemPickers(orgId, {
    category: item ? { id: item.categoryId, name: item.categoryName } : null,
    baseUnit: item ? { id: item.baseUnit.id, name: unitLabel(item.baseUnit) } : null,
  })

  // Called only when Zod validation passes (react-hook-form guards the fields).
  const handleSubmit = async (values: UpdateItemFormValues) => {
    if (!item) return
    setServerError(null)
    try {
      const response = await updateMutation.mutateAsync({
        orgId,
        itemId,
        data: toUpdateItemInput(values, item),
      })
      onSuccess?.(normalizeItem(response.data))
    } catch (e) {
      setServerError(parseApiError(e).message || null)
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4" aria-busy>
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!item) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error ? parseApiError(error).message : null}
      </p>
    )
  }

  // The collection picker is create-only: an edit changes the base unit, not the collection.
  const { unitCollection: _unitCollection, ...editPickers } = pickers

  return (
    <>
      <UpdateItemForm
        copy={copy}
        pickers={editPickers}
        valuationOptions={valuationOptions}
        item={item}
        onSubmit={handleSubmit}
        isPending={updateMutation.isPending}
        errorMessage={serverError}
      />
      {createCategoryDialog}
    </>
  )
}
