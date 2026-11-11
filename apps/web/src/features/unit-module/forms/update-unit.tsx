import { useState } from "react"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { normalizeUnit, useUpdateUnitMutation } from "../unit-api"
import type { UnitDto } from "../types"
import { toUpdateUnitInput } from "./unit-form-schema"
import { UpdateUnitForm } from "./update-unit-form"
import type { UpdateUnitFormValues } from "./unit-form-types"
import { useUnitFormCopy } from "./use-unit-form-copy"

type UpdateUnitProps = {
  orgId: string
  unit: UnitDto
  onSuccess?: (unit: UnitDto) => void
  onCancel?: () => void
}

export function UpdateUnit({ orgId, unit, onSuccess, onCancel }: UpdateUnitProps) {
  const copy = useUnitFormCopy()
  const updateMutation = useUpdateUnitMutation(orgId)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (values: UpdateUnitFormValues) => {
    setErrorMessage(null)
    try {
      const res = await updateMutation.mutateAsync({
        orgId,
        unitId: unit.id,
        data: toUpdateUnitInput(values),
      })
      if (res.data) {
        onSuccess?.(normalizeUnit(res.data))
      }
    } catch (err) {
      const parsed = parseApiError(err)
      setErrorMessage(parsed.message || null)
    }
  }

  return (
    <UpdateUnitForm
      unit={unit}
      copy={copy}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      isPending={updateMutation.isPending}
      errorMessage={errorMessage}
    />
  )
}

