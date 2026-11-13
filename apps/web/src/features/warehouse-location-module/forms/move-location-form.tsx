import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { MoveWarehouseLocationSchema } from "@avuny/contracts"

import {
  AsyncComboboxField,
  FormShell,
  SubmitButton,
  type AsyncComboboxCopy,
  type AsyncOptionsSource,
} from "@workspace/ui/blocks/form"
import type { FieldCopy } from "@workspace/ui/blocks/types"
import { mapBlanks } from "@/features/lib/forms/blank-values"

import type { MoveWarehouseLocationInput } from "../types"
import type { LocationActionFormCopy } from "./location-form-types"

import type { z } from "@avuny/zod"

export type MoveLocationFormValues = MoveWarehouseLocationInput
type MoveLocationFormInput = z.input<typeof MoveWarehouseLocationSchema>

type MoveLocationFormProps = {
  copy: LocationActionFormCopy & { parent: FieldCopy }
  comboboxCopy: AsyncComboboxCopy
  /** Containers of the warehouse (valid parents). */
  parentSource: AsyncOptionsSource
  onSubmit: (values: MoveLocationFormValues) => void
  isPending: boolean
  errorMessage?: string | null
}

const baseResolver = zodResolver(MoveWarehouseLocationSchema)

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function MoveLocationForm({ copy, comboboxCopy, parentSource, onSubmit, isPending, errorMessage }: MoveLocationFormProps) {
  const form = useForm<MoveLocationFormInput, unknown, MoveLocationFormValues>({
    // No parent chosen means "move to the top level": the contract wants null, the field gives "".
    resolver: (values, context, options) => baseResolver(mapBlanks(values, ["parentId"], null), context, options),
    defaultValues: { parentId: "" },
  })

  return (
    <FormShell title={copy.title} description={copy.description} errorMessage={errorMessage}>
      <form onSubmit={form.handleSubmit((values) => onSubmit(values))} noValidate className="space-y-6">
        <AsyncComboboxField
          control={form.control}
          name="parentId"
          copy={copy.parent}
          comboboxCopy={comboboxCopy}
          source={parentSource}
          disabled={isPending}
          placeholder={copy.parent.placeholder}
        />
        <SubmitButton className="w-full" loading={isPending} label={copy.submitLabel} loadingLabel={copy.submittingLabel} />
      </form>
    </FormShell>
  )
}
