import { useState } from "react"
import { useAsyncComboboxCopy } from "@/features/lib/options/use-async-combobox-copy"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { getAllowedLocationTypes, useWarehouseLocationLabels } from "../lib"
import type { BulkCreateWarehouseLocationsResult, LocationParentRef, LocationWarehouse } from "../types"
import { useBulkCreateLocationsMutation, useLocationOptions } from "../warehouse-location-api"
import { BulkGenerateForm, type BulkGenerateFormValues } from "./bulk-generate-form"
import { useLocationBulkFormCopy } from "./use-location-form-copy"

type BulkGenerateLocationsProps = {
  orgId: string
  warehouse: LocationWarehouse
  /** Given: the branch is generated inside it. */
  parent?: LocationParentRef
  onSuccess?: (result: BulkCreateWarehouseLocationsResult) => void
}

// Composition only: strings + API behavior wired into the pure form (preview = dry run, submit = real run).
export function BulkGenerateLocations({ orgId, warehouse, parent, onSuccess }: BulkGenerateLocationsProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [preview, setPreview] = useState<BulkCreateWarehouseLocationsResult | null>(null)
  const mutation = useBulkCreateLocationsMutation(orgId, warehouse.id)
  const copy = useLocationBulkFormCopy()
  const comboboxCopy = useAsyncComboboxCopy()
  const parentSource = useLocationOptions(orgId, { warehouseId: warehouse.id, containerOnly: true })
  const { getTypeLabel } = useWarehouseLocationLabels()

  const typeOptions = getAllowedLocationTypes(parent?.type ?? null, warehouse.type).map((value) => ({
    value,
    label: getTypeLabel(value),
  }))

  const run = async (values: BulkGenerateFormValues) => {
    setServerError(null)
    try {
      const response = await mutation.mutateAsync({
        orgId,
        warehouseId: warehouse.id,
        data: { ...values, parentId: parent?.id ?? values.parentId ?? null },
      })
      return response.data as BulkCreateWarehouseLocationsResult
    } catch (e) {
      setServerError(parseApiError(e).message || null) // e.g. code collisions: already localized
      return null
    }
  }

  const handlePreview = async (values: BulkGenerateFormValues) => {
    const result = await run({ ...values, dryRun: true })
    if (result) setPreview(result)
  }
  const handleSubmit = async (values: BulkGenerateFormValues) => {
    const result = await run({ ...values, dryRun: false })
    if (result) onSuccess?.(result)
  }

  return (
    <BulkGenerateForm
      copy={copy}
      comboboxCopy={comboboxCopy}
      parentSource={parentSource}
      fixedParent={parent ?? null}
      warehouseType={warehouse.type}
      typeOptions={typeOptions}
      preview={preview}
      isPreviewing={mutation.isPending && mutation.variables?.data.dryRun === true}
      onPreview={handlePreview}
      onSubmit={handleSubmit}
      isPending={mutation.isPending && mutation.variables?.data.dryRun !== true}
      errorMessage={serverError}
    />
  )
}
