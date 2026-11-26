import React from "react"
import { Plus } from "lucide-react"
import type { UseFormReturn } from "react-hook-form"
import { Button } from "@workspace/ui/components/button"
import {
  setPrimaryIndex,
  ensurePrimaryOnAdd,
  ensurePrimaryOnRemove,
} from "../lib/contact-primary.js"
import type { PartyFormValues } from "../types.js"

export interface ContactCollectionEditorProps<T extends { isPrimary: boolean }> {
  title: string
  addLabel: string
  emptyText?: string
  fieldArray: {
    fields: readonly unknown[]
    replace: (values: T[]) => void
  }
  form: UseFormReturn<PartyFormValues>
  fieldName: "emails" | "phones" | "addresses"
  createNewItem: () => T
  renderRow: (
    index: number,
    onRemove: () => void,
    onSetPrimary: () => void
  ) => React.ReactNode
}

export function ContactCollectionEditor<T extends { isPrimary: boolean }>({
  title,
  addLabel,
  emptyText,
  fieldArray,
  form,
  fieldName,
  createNewItem,
  renderRow,
}: ContactCollectionEditorProps<T>) {
  const { fields, replace } = fieldArray

  const handleAdd = () => {
    const newItem = createNewItem()
    const current = ((form.getValues(fieldName) as unknown as T[]) || [])
    const updated = ensurePrimaryOnAdd([...current, newItem])
    replace(updated)
  }

  const handleRemove = (index: number) => {
    const current = ((form.getValues(fieldName) as unknown as T[]) || [])
    const updated = ensurePrimaryOnRemove(current, index)
    replace(updated)
  }

  const handleSetPrimary = (index: number) => {
    const current = ((form.getValues(fieldName) as unknown as T[]) || [])
    const updated = setPrimaryIndex(current, index)
    replace(updated)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{title}</h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={handleAdd}
        >
          <Plus className="size-3.5" aria-hidden />
          {addLabel}
        </Button>
      </div>

      {fields.length === 0 ? (
        <div className="bg-muted/30 text-muted-foreground border-border rounded-lg border border-dashed p-4 text-center text-xs">
          {emptyText || `No ${title.toLowerCase()} added yet.`}
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map((field, idx) => (
            <React.Fragment key={(field as { id?: string }).id ?? idx}>
              {renderRow(
                idx,
                () => handleRemove(idx),
                () => handleSetPrimary(idx)
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  )
}
