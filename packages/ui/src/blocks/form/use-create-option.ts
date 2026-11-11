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

import type {
  ComboboxCreateAction,
  ComboboxEditAction,
  ComboboxOption,
} from "./async-combobox"

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

export function useEditOption<TUpdated = unknown>(
  toOption?: (updated: TUpdated) => ComboboxOption
) {
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<ComboboxOption | null>(null)

  const action = useCallback(
    (label?: string): ComboboxEditAction => ({
      label,
      onEdit: (option: ComboboxOption) => {
        setTarget(option)
        setOpen(true)
      },
    }),
    []
  )

  const onUpdated = useCallback(
    (updated?: TUpdated) => {
      if (updated && toOption) {
        setTarget(toOption(updated))
      }
      setOpen(false)
    },
    [toOption]
  )

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setTarget(null)
    }
  }, [])

  return {
    open,
    setOpen: handleOpenChange,
    target,
    targetId: target?.id,
    action,
    onUpdated,
  }
}

/**
 * Combines create and edit dialog state for a combobox.
 * If targetId is undefined, dialog operates in "create" mode; if present, in "update" mode.
 */
export function useComboboxAction<TItem = unknown>(
  toOption: (item: TItem) => ComboboxOption
) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [target, setTarget] = useState<ComboboxOption | null>(null)
  const selectRef = useRef<((option: ComboboxOption) => void) | null>(null)

  const createAction = useCallback(
    (label: string): ComboboxCreateAction => ({
      label,
      onClick: ({ search, select }) => {
        selectRef.current = select
        setSearch(search)
        setTarget(null)
        setOpen(true)
      },
    }),
    []
  )

  const editAction = useCallback(
    (label?: string): ComboboxEditAction => ({
      label,
      onEdit: (option: ComboboxOption) => {
        setTarget(option)
        setSearch("")
        setOpen(true)
      },
    }),
    []
  )

  const onSuccess = useCallback(
    (item: TItem) => {
      const opt = toOption(item)
      selectRef.current?.(opt)
      selectRef.current = null
      setTarget(null)
      setOpen(false)
    },
    [toOption]
  )

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setTarget(null)
      selectRef.current = null
    }
  }, [])

  return {
    open,
    setOpen: handleOpenChange,
    target,
    targetId: target?.id,
    search,
    createAction,
    editAction,
    onSuccess,
  }
}
