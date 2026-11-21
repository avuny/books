import { useEffect, useRef, type ReactNode } from "react"
import {
  useFieldArray,
  useWatch,
  type ArrayPath,
  type Control,
  type FieldArray,
  type FieldArrayWithId,
  type FieldValues,
  type PathValue,
} from "react-hook-form"
import { Plus, Trash2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import type { FieldCopy } from "@workspace/ui/blocks/types"

import { AsyncComboboxField } from "./async-combobox-field"
import type { AsyncComboboxCopy, AsyncOptionsSource } from "./async-combobox"

export type LineItemsCopy = {
  title?: string
  addLine?: string
  removeLine?: string
  noLines?: string
  item?: FieldCopy
}

export type LineItemRenderContext<TLine = any> = {
  index: number
  isItemSelected: boolean
  disabled: boolean
  line?: TLine
}

export type LineItemsProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends ArrayPath<TFieldValues> = ArrayPath<TFieldValues>,
> = {
  control: Control<TFieldValues, any, any>
  name: TName
  blankLine: FieldArray<TFieldValues, TName>
  itemFieldName?: string
  itemColSpan?: string
  copy: LineItemsCopy
  disabled?: boolean
  className?: string
  // Item Combobox integration
  itemSource: AsyncOptionsSource
  itemComboboxCopy: AsyncComboboxCopy
  itemPlaceholder?: string
  onItemChange?: (index: number, itemId: string) => void
  // Render functions
  renderFields: (
    context: LineItemRenderContext<PathValue<TFieldValues, TName>[number]>
  ) => ReactNode
  renderRowFooter?: (
    context: LineItemRenderContext<PathValue<TFieldValues, TName>[number]>
  ) => ReactNode
  headerActions?: ReactNode
}

/**
 * Reusable Zoho-style document line items component.
 *
 * Behaviors:
 * 1. Default line: Always ensures at least one default line is present.
 * 2. Disabled fields: All custom fields in a line remain disabled until an item is selected.
 * 3. Auto-append: When an item is selected on the last line, a new empty line is automatically appended.
 * 4. Remove line: Deleting lines preserves at least one line (clearing it if it is the only one).
 */
export function LineItems<
  TFieldValues extends FieldValues = FieldValues,
  TName extends ArrayPath<TFieldValues> = ArrayPath<TFieldValues>,
>({
  control,
  name,
  blankLine,
  itemFieldName = "itemId",
  itemColSpan = "sm:col-span-7",
  copy,
  disabled = false,
  className,
  itemSource,
  itemComboboxCopy,
  itemPlaceholder,
  onItemChange,
  renderFields,
  renderRowFooter,
  headerActions,
}: LineItemsProps<TFieldValues, TName>) {
  const { fields, append, remove, update } = useFieldArray({
    control,
    name,
  })

  const linesWatch = useWatch({
    control,
    name: name as any,
  }) as PathValue<TFieldValues, TName> | undefined

  const blankLineRef = useRef(blankLine)
  blankLineRef.current = blankLine

  // 1. Ensure at least one default line is always present
  useEffect(() => {
    if (fields.length === 0) {
      append(blankLineRef.current)
    }
  }, [fields.length, append])

  // Track the last item IDs to detect transitions from empty to selected
  const prevItemIdsRef = useRef<Record<number, string>>({})
  // Track the highest row index that triggered an auto-append to ensure exactly ONE row is added per filled line
  const lastAppendedIndexRef = useRef<number>(-1)

  // 2. Zoho-style auto-append: when user selects an item in the last row, auto-append a new blank row exactly once
  useEffect(() => {
    const currentLines = linesWatch as any[] | undefined
    if (!currentLines || currentLines.length === 0) return

    currentLines.forEach((line, index) => {
      const currentItemId = line?.[itemFieldName] ?? ""
      const prevItemId = prevItemIdsRef.current[index] ?? ""

      // Call onItemChange if item transitioned
      if (currentItemId !== prevItemId) {
        prevItemIdsRef.current[index] = currentItemId
        if (currentItemId) {
          onItemChange?.(index, currentItemId)
        }
      }

      // If item was selected on the last row and we haven't already auto-appended for this index
      if (
        index === currentLines.length - 1 &&
        Boolean(currentItemId) &&
        lastAppendedIndexRef.current < index
      ) {
        lastAppendedIndexRef.current = index
        append(blankLineRef.current)
      }
    })
  }, [linesWatch, itemFieldName, append, onItemChange])

  const handleRemove = (index: number) => {
    if (disabled) return
    if (fields.length <= 1) {
      // If only 1 line, reset it back to blank
      update(0, blankLineRef.current)
      delete prevItemIdsRef.current[0]
      lastAppendedIndexRef.current = -1
    } else {
      remove(index)
      // Shift tracked ids
      const newMap: Record<number, string> = {}
      let targetIdx = 0
      for (let i = 0; i < fields.length; i++) {
        if (i !== index) {
          if (prevItemIdsRef.current[i]) {
            newMap[targetIdx] = prevItemIdsRef.current[i]
          }
          targetIdx++
        }
      }
      prevItemIdsRef.current = newMap
      lastAppendedIndexRef.current = Math.max(-1, fields.length - 2)
    }
  }

  const handleManualAdd = () => {
    if (disabled) return
    lastAppendedIndexRef.current = fields.length
    append(blankLineRef.current)
  }

  return (
    <div
      className={cn(
        "space-y-4 rounded-lg border border-border bg-card/40 p-4",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {copy.title ? (
            <h3 className="text-base font-semibold text-foreground">
              {copy.title}
            </h3>
          ) : null}
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {fields.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {headerActions}
          {copy.addLine ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={handleManualAdd}
            >
              <Plus className="me-1 size-4" />
              {copy.addLine}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        {fields.map(
          (fieldItem: FieldArrayWithId<TFieldValues, TName>, index: number) => {
            const currentLine = (linesWatch as any)?.[index]
            const isItemSelected = Boolean(currentLine?.[itemFieldName])
            const isRowDisabled = disabled || !isItemSelected

            return (
              <div
                key={fieldItem.id}
                className={cn(
                  "relative rounded-lg border p-3 transition-colors",
                  isItemSelected
                    ? "border-border/80 bg-background/60 shadow-xs"
                    : "border-dashed border-border/70 bg-muted/20"
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Row Number Badge */}
                  <div className="flex shrink-0 items-center justify-center pt-2">
                    <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      {index + 1}
                    </span>
                  </div>

                  {/* Line Fields Grid */}
                  <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-12">
                    {/* Item Picker (Always enabled unless whole form is pending/disabled) */}
                    <div className={itemColSpan}>
                      <AsyncComboboxField
                        control={control}
                        name={`${name}.${index}.${itemFieldName}` as any}
                        copy={
                          copy.item ?? {
                            label: "Item",
                            placeholder: itemPlaceholder ?? "Select an item",
                          }
                        }
                        comboboxCopy={itemComboboxCopy}
                        source={itemSource}
                        placeholder={
                          itemPlaceholder ??
                          copy.item?.placeholder ??
                          "Select an item"
                        }
                        disabled={disabled}
                      />
                    </div>

                    {/* Document specific fields (Disabled until item is selected) */}
                    {renderFields({
                      index,
                      isItemSelected,
                      disabled: isRowDisabled,
                      line: currentLine,
                    })}
                  </div>

                  {/* Delete button */}
                  <div className="flex shrink-0 items-center pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={copy.removeLine ?? "Remove line"}
                      disabled={
                        disabled || (fields.length === 1 && !isItemSelected)
                      }
                      onClick={() => handleRemove(index)}
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                {/* Optional Row Footer (e.g. difference, totals, alerts) */}
                {renderRowFooter ? (
                  <div className="mt-2 border-t border-border/40 ps-9 pt-2">
                    {renderRowFooter({
                      index,
                      isItemSelected,
                      disabled: isRowDisabled,
                      line: currentLine,
                    })}
                  </div>
                ) : null}
              </div>
            )
          }
        )}
      </div>
    </div>
  )
}
