import { useState } from "react"

import { parseApiError } from "@workspace/ui/lib/api-error"

import {
  normalizeItemCategory,
  useCreateItemCategoryMutation,
} from "../item-category-api"
import type { ItemCategoryDto } from "../types"
import {
  CreateItemCategoryForm,
  type CreateItemCategoryFormValues,
} from "./create-item-category-form"
import { toCreateItemCategoryInput } from "./item-category-form-schema"
import {
  useItemCategoryFormCopy,
  useItemCategoryParentPicker,
} from "./use-item-category-form-copy"

type CreateItemCategoryProps = {
  orgId: string
  /** Prefill, e.g. the text typed in a combobox before pressing "Create new". */
  defaultName?: string
  onSuccess?: (category: ItemCategoryDto) => void
}

// Composition only: strings + API behavior wired into the pure form.
export function CreateItemCategory({
  orgId,
  defaultName,
  onSuccess,
}: CreateItemCategoryProps) {
  const [serverError, setServerError] = useState<string | null>(null)

  const createMutation = useCreateItemCategoryMutation(orgId)
  const copy = useItemCategoryFormCopy("create")
  const parent = useItemCategoryParentPicker(orgId)

  // Called only when Zod validation passes (react-hook-form guards the fields).
  const handleSubmit = async (values: CreateItemCategoryFormValues) => {
    setServerError(null)
    try {
      const response = await createMutation.mutateAsync({
        orgId,
        data: toCreateItemCategoryInput(values),
      })
      onSuccess?.(normalizeItemCategory(response.data))
    } catch (e) {
      setServerError(parseApiError(e).message || null)
    }
  }

  return (
    <CreateItemCategoryForm
      copy={copy}
      parent={parent}
      defaultName={defaultName}
      onSubmit={handleSubmit}
      isPending={createMutation.isPending}
      errorMessage={serverError}
    />
  )
}
