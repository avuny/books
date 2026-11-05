/**
 * @workspace/ui/blocks/form/use-create-option.ts (new; export it from blocks/form)
 *
 * Glue between a combobox's "Create new" button and whatever creates the item (a dialog, a sheet).
 *
 *   const createRole = useCreateOption((role: RoleDto) => ({ id: role.id, name: role.name }))
 *
 *   <AsyncComboboxField createAction={createRole.action("Create new role")} … />
 *   <RoleDialog open={createRole.open} onOpenChange={createRole.setOpen} onSuccess={createRole.onCreated} />
 */
import { useCallback, useRef, useState } from "react"

import type { ComboboxCreateAction, ComboboxOption } from "./async-combobox"

export function useCreateOption<TCreated>(
  toOption: (created: TCreated) => ComboboxOption
) {
  const [open, setOpen] = useState(false)
  // What the user had typed when they pressed "Create new": use it to prefill the create form.
  const [search, setSearch] = useState("")
  const selectRef = useRef<((option: ComboboxOption) => void) | null>(null)

  const action = useCallback(
    (label: string): ComboboxCreateAction => ({
      label,
      onClick: ({ search, select }) => {
        selectRef.current = select
        setSearch(search)
        setOpen(true)
      },
    }),
    []
  )

  /** Call with the created item: selects it in the combobox and closes the create UI. */
  const onCreated = useCallback(
    (created: TCreated) => {
      selectRef.current?.(toOption(created))
      selectRef.current = null
      setOpen(false)
    },
    [toOption]
  )

  return { open, setOpen, search, action, onCreated }
}
