import { useState } from "react"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { normalizeWarehouse, useCreateWarehouseMutation } from "../warehouse-api"
import type { WarehouseDto } from "../types"
import { CreateWarehouseForm, type CreateWarehouseFormValues } from "./create-warehouse-form"
import { useWarehouseFormCopy } from "./use-warehouse-form-copy"

type CreateWarehouseProps = {
  orgId: string
  onSuccess?: (warehouse: WarehouseDto) => void // the caller decides what happens next
}

// Composition only: strings + API behavior wired into the pure form.
export function CreateWarehouse({ orgId, onSuccess }: CreateWarehouseProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const createMutation = useCreateWarehouseMutation(orgId)
  const copy = useWarehouseFormCopy("create")

  // Called only when Zod validation passes (react-hook-form guards the fields).
  const handleSubmit = async (values: CreateWarehouseFormValues) => {
    setServerError(null)
    try {
      const response = await createMutation.mutateAsync({ orgId, data: values })
      onSuccess?.(normalizeWarehouse(response.data))
    } catch (e) {
      setServerError(parseApiError(e).message || null) // already localized by the server
    }
  }

  return (
    <CreateWarehouseForm copy={copy} onSubmit={handleSubmit} isPending={createMutation.isPending} errorMessage={serverError} />
  )
}
