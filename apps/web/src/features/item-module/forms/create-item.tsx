import { useState } from "react"

import { parseApiError } from "@workspace/ui/lib/api-error"

import { normalizeItem, useCreateItemMutation } from "../item-api"
import type { ItemDto } from "../types"
import { CreateItemForm, type CreateItemFormValues } from "./create-item-form"
import { toCreateItemInput } from "./item-form-schema"
import { useItemFormCopy, useValuationOptions } from "./use-item-form-copy"
import { useItemPickers } from "./use-item-pickers"

type CreateItemProps = {
  orgId: string
  defaultName?: string
  onSuccess?: (item: ItemDto) => void
}

// Composition only: strings + API behavior wired into the pure form.
export function CreateItem({ orgId, defaultName, onSuccess }: CreateItemProps) {
  const [serverError, setServerError] = useState<string | null>(null)

  const createMutation = useCreateItemMutation(orgId)
  const copy = useItemFormCopy("create")
  const valuationOptions = useValuationOptions()
  const { pickers, dialogs } = useItemPickers(orgId)

  // Called only when Zod validation passes (react-hook-form guards the fields).
  const handleSubmit = async (values: CreateItemFormValues) => {
    setServerError(null)
    try {
      const response = await createMutation.mutateAsync({
        orgId,
        data: toCreateItemInput(values),
      })
      onSuccess?.(normalizeItem(response.data))
    } catch (e) {
      console.error("Error creating item:", parseApiError(e))
      setServerError(parseApiError(e).message || null)
    }
  }

  return (
    <>
      <CreateItemForm
        copy={copy}
        pickers={pickers}
        valuationOptions={valuationOptions}
        defaultName={defaultName}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending}
        errorMessage={serverError}
      />
      {dialogs}
    </>
  )
}
