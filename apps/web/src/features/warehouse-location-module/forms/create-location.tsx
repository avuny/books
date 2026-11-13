import { useState } from "react"
import { useAsyncComboboxCopy } from "@/features/lib/options/use-async-combobox-copy"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { getAllowedLocationTypes, suggestedCodePrefix, useWarehouseLocationLabels } from "../lib"
import type { LocationParentRef, LocationWarehouse, WarehouseLocationDto } from "../types"
import { fetchNextLocationCode, useCreateLocationMutation, useLocationOptions } from "../warehouse-location-api"
import { CreateLocationForm, type CreateLocationFormValues } from "./create-location-form"
import { useLocationFormCopy } from "./use-location-form-copy"

type CreateLocationProps = {
  orgId: string
  warehouse: LocationWarehouse
  /** Given: the location is created inside it ("Add child"). */
  parent?: LocationParentRef
  onSuccess?: (location: WarehouseLocationDto) => void // the caller decides what happens next
}

// Composition only: strings + API behavior wired into the pure form.
export function CreateLocation({ orgId, warehouse, parent, onSuccess }: CreateLocationProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const createMutation = useCreateLocationMutation(orgId, warehouse.id)
  const copy = useLocationFormCopy("create")
  const comboboxCopy = useAsyncComboboxCopy()
  const parentSource = useLocationOptions(orgId, { warehouseId: warehouse.id, containerOnly: true })
  const { getTypeLabel } = useWarehouseLocationLabels()

  const typeOptions = getAllowedLocationTypes(parent?.type ?? null, warehouse.type).map((value) => ({
    value,
    label: getTypeLabel(value),
  }))

  // Called only when Zod validation passes (react-hook-form guards the fields).
  const handleSubmit = async (values: CreateLocationFormValues) => {
    setServerError(null)
    try {
      const response = await createMutation.mutateAsync({
        orgId,
        warehouseId: warehouse.id,
        data: { ...values, parentId: parent?.id ?? values.parentId ?? null },
      })
      onSuccess?.(response.data as WarehouseLocationDto)
    } catch (e) {
      setServerError(parseApiError(e).message || null) // already localized by the server
    }
  }

  return (
    <CreateLocationForm
      copy={copy}
      comboboxCopy={comboboxCopy}
      parentSource={parentSource}
      fixedParent={parent ? { id: parent.id, name: parent.name } : null}
      typeOptions={typeOptions}
      onSuggestCode={async ({ type, parentId }) => {
        try {
          return await fetchNextLocationCode(orgId, warehouse.id, { parentId, prefix: suggestedCodePrefix(type) })
        } catch {
          return null // a missed suggestion is not worth an error message
        }
      }}
      onSubmit={handleSubmit}
      isPending={createMutation.isPending}
      errorMessage={serverError}
    />
  )
}
