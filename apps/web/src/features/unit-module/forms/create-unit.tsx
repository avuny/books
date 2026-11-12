import { useState } from "react"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { normalizeUnit, useCreateUnitMutation } from "../unit-api"
import type { UnitDto } from "../types"
import { CreateUnitForm } from "./create-unit-form"
import { toCreateUnitInput } from "./unit-form-schema"
import type { CreateUnitFormValues } from "./unit-form-types"
import { useUnitFormCopy } from "./use-unit-form-copy"

type CreateUnitProps = {
  orgId: string
  onSuccess?: (unit: UnitDto) => void
  onCancel?: () => void
}

export function CreateUnit({ orgId, onSuccess, onCancel }: CreateUnitProps) {
  const copy = useUnitFormCopy()
  const createMutation = useCreateUnitMutation(orgId)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (values: CreateUnitFormValues) => {
    setErrorMessage(null)
    try {
      const res = await createMutation.mutateAsync({
        orgId,
        data: toCreateUnitInput(values),
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
    <CreateUnitForm
      copy={copy}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      isPending={createMutation.isPending}
      errorMessage={errorMessage}
    />
  )
}

