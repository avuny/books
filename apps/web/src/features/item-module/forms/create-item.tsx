import { useMemo, useState } from "react"

import { parseApiError } from "@workspace/ui/lib/api-error"

import { useUnitCollection } from "../../unit-collection-module"
import { normalizeItem, useCreateItemMutation } from "../item-api"
import type { ItemDto } from "../types"
import { useAsyncComboboxCopy } from "../../lib/options/use-async-combobox-copy"
import { CreateItemForm, type CreateItemFormValues } from "./create-item-form"
import { toCreateItemInput } from "./item-form-schema"
import { toCollectionUnitOptions } from "./collection-units"
import {
  useItemFormCopy,
  useShelfLifeUnitOptions,
  useValuationOptions,
} from "./use-item-form-copy"
import { useItemPickers } from "./use-item-pickers"

type CreateItemProps = {
  orgId: string
  defaultName?: string
  onSuccess?: (item: ItemDto) => void
}

// Composition only: strings + API behavior wired into the pure form.
export function CreateItem({ orgId, defaultName, onSuccess }: CreateItemProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [collectionId, setCollectionId] = useState<string | undefined>()

  const createMutation = useCreateItemMutation(orgId)
  const copy = useItemFormCopy("create")
  const valuationOptions = useValuationOptions()
  const shelfLifeUnitOptions = useShelfLifeUnitOptions()
  const comboboxCopy = useAsyncComboboxCopy()
  const { pickers, dialogs } = useItemPickers(orgId)
  // The picked collection's units feed the per-unit prices and the unit of opening stock lines.
  const { collection } = useUnitCollection(orgId, collectionId ?? "")
  const collectionUnits = useMemo(
    () => toCollectionUnitOptions(collection),
    [collection]
  )

  // Called only when Zod validation passes (react-hook-form guards the fields).
  const handleSubmit = async (values: CreateItemFormValues) => {
    setServerError(null)
    try {
      const response = await createMutation.mutateAsync({
        orgId,
        data: toCreateItemInput(values, { baseUnitId: collection?.baseUnitId }),
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
        shelfLifeUnitOptions={shelfLifeUnitOptions}
        defaultName={defaultName}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending}
        errorMessage={serverError}
        locationSource={pickers.openingStockLocation.source}
        comboboxCopy={comboboxCopy}
        collectionUnits={collectionUnits}
        onCollectionChange={setCollectionId}
      />
      {dialogs}
    </>
  )
}
