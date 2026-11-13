import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { BlockWarehouseLocationSchema } from "@avuny/contracts"

import { FormShell, InputField, SubmitButton } from "@workspace/ui/blocks/form"
import type { FieldCopy } from "@workspace/ui/blocks/types"

import type { BlockWarehouseLocationInput } from "../types"
import type { LocationActionFormCopy } from "./location-form-types"

export type BlockLocationFormValues = BlockWarehouseLocationInput

type BlockLocationFormProps = {
  copy: LocationActionFormCopy & { reason: FieldCopy }
  onSubmit: (values: BlockLocationFormValues) => void
  isPending: boolean
  errorMessage?: string | null
}

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function BlockLocationForm({ copy, onSubmit, isPending, errorMessage }: BlockLocationFormProps) {
  const form = useForm<BlockLocationFormValues>({
    resolver: zodResolver(BlockWarehouseLocationSchema),
    defaultValues: { reason: "" },
  })

  return (
    <FormShell title={copy.title} description={copy.description} errorMessage={errorMessage}>
      <form onSubmit={form.handleSubmit((values) => onSubmit(values))} noValidate className="space-y-6">
        <InputField control={form.control} name="reason" copy={copy.reason} type="text" autoComplete="off" autoFocus disabled={isPending} />
        <SubmitButton className="w-full" loading={isPending} label={copy.submitLabel} loadingLabel={copy.submittingLabel} />
      </form>
    </FormShell>
  )
}
