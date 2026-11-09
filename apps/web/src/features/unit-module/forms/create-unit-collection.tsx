import { useState } from "react"

import { parseApiError } from "@workspace/ui/lib/api-error"

import { normalizeUnitCollection, useCreateUnitCollectionMutation } from "../unit-api"
import type { UnitCollectionDto } from "../types"
import {
  CreateUnitCollectionForm,
  type CreateUnitCollectionFormValues,
} from "./create-unit-collection-form"
import { toCreateUnitCollectionInput } from "./unit-collection-form-schema"
import { useUnitCollectionFormCopy, useUnitPicker } from "./use-unit-collection-form-copy"

type CreateUnitCollectionProps = {
  orgId: string
  onSuccess?: (collection: UnitCollectionDto) => void
}

// Composition only: strings + API behavior wired into the pure form.
export function CreateUnitCollection({ orgId, onSuccess }: CreateUnitCollectionProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [baseUnitId, setBaseUnitId] = useState<string | undefined>(undefined)

  const createMutation = useCreateUnitCollectionMutation(orgId)
  const copy = useUnitCollectionFormCopy("create")
  const baseUnitPicker = useUnitPicker(orgId)
  // The other units must measure the same thing as the base unit.
  const extraUnitPicker = useUnitPicker(orgId, { sameTypeAs: baseUnitId })

  // Called only when Zod validation passes (react-hook-form guards the fields).
  const handleSubmit = async (values: CreateUnitCollectionFormValues) => {
    setServerError(null)
    try {
      const response = await createMutation.mutateAsync({
        orgId,
        data: toCreateUnitCollectionInput(values),
      })
      onSuccess?.(normalizeUnitCollection(response.data))
    } catch (e) {
      setServerError(parseApiError(e).message || null)
    }
  }

  return (
    <CreateUnitCollectionForm
      copy={copy}
      baseUnitPicker={baseUnitPicker}
      extraUnitPicker={extraUnitPicker}
      onBaseUnitChange={setBaseUnitId}
      onSubmit={handleSubmit}
      isPending={createMutation.isPending}
      errorMessage={serverError}
    />
  )
}
