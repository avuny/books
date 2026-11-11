import { useMemo, useState } from "react"

import { Skeleton } from "@workspace/ui/components/skeleton"
import { parseApiError } from "@workspace/ui/lib/api-error"

import {
  normalizeUnitCollection,
  unitLabel,
  useUnitCollection,
  useUpdateUnitCollectionMutation,
} from "../unit-collection-api"
import type { UnitCollectionDto } from "../types"
import { toUpdateUnitCollectionInput } from "./unit-collection-form-schema"
import {
  UpdateUnitCollectionForm,
  type UpdateUnitCollectionFormValues,
} from "./update-unit-collection-form"
import type { UnitInitialOptions } from "./unit-collection-form-types"
import {
  useExtraUnitPickerConfig,
  useUnitCollectionFormCopy,
} from "./use-unit-collection-form-copy"

type UpdateUnitCollectionProps = {
  orgId: string
  /** The list rows don't carry the units, so the collection is loaded by id. */
  collectionId: string
  onSuccess?: (collection: UnitCollectionDto) => void
}

// Composition only: loads the collection, wires strings + API behavior into the pure form.
export function UpdateUnitCollection({
  orgId,
  collectionId,
  onSuccess,
}: UpdateUnitCollectionProps) {
  const [serverError, setServerError] = useState<string | null>(null)

  const { collection, isLoading, error } = useUnitCollection(
    orgId,
    collectionId
  )
  const updateMutation = useUpdateUnitCollectionMutation(orgId)
  const copy = useUnitCollectionFormCopy("update")
  const extraUnitPickerConfig = useExtraUnitPickerConfig(orgId, {
    sameTypeAs: collection?.baseUnitId,
  })

  const initialOptions = useMemo<UnitInitialOptions>(
    () =>
      Object.fromEntries(
        (collection?.units ?? []).map((unit) => [
          unit.id,
          { id: unit.id, name: unitLabel(unit) },
        ])
      ),
    [collection]
  )
  const baseUnit = collection?.units.find((unit) => unit.isBase)

  // Called only when Zod validation passes (react-hook-form guards the fields).
  const handleSubmit = async (values: UpdateUnitCollectionFormValues) => {
    setServerError(null)
    try {
      const response = await updateMutation.mutateAsync({
        orgId,
        collectionId,
        data: toUpdateUnitCollectionInput(values),
      })
      onSuccess?.(normalizeUnitCollection(response.data))
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
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!collection) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error ? parseApiError(error).message : null}
      </p>
    )
  }

  return (
    <UpdateUnitCollectionForm
      copy={copy}
      collection={collection}
      baseUnitLabel={baseUnit ? unitLabel(baseUnit) : ""}
      extraUnitPickerConfig={extraUnitPickerConfig}
      initialOptions={initialOptions}
      onSubmit={handleSubmit}
      isPending={updateMutation.isPending}
      errorMessage={serverError}
    />
  )
}
