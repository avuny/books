import * as React from "react"
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form"
import { format, isValid, parseISO } from "date-fns"
import { CalendarIcon, X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"
import type { FieldCopy } from "@workspace/ui/blocks/types"

export type DatePickerFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  control: Control<TFieldValues, any, any>
  name: TName
  copy: FieldCopy
  disabled?: boolean
  className?: string
  placeholder?: string
  action?: React.ReactNode
  minDate?: Date
  maxDate?: Date
  clearable?: boolean
}

/**
 * Parses a "YYYY-MM-DD" or ISO string into a local Date object without UTC timezone shifting.
 */
function parseLocalDate(value: unknown): Date | undefined {
  if (!value) return undefined
  if (value instanceof Date) return isValid(value) ? value : undefined
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    // If simple "YYYY-MM-DD", construct local date to avoid UTC midnight timezone rollback
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [yearStr, monthStr, dayStr] = trimmed.split("-")
      const year = Number(yearStr)
      const month = Number(monthStr) - 1
      const day = Number(dayStr)
      const date = new Date(year, month, day)
      return isValid(date) ? date : undefined
    }
    const parsed = parseISO(trimmed)
    return isValid(parsed) ? parsed : undefined
  }
  return undefined
}

export function DatePickerField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  copy,
  disabled = false,
  className,
  placeholder,
  action,
  minDate,
  maxDate,
  clearable = true,
}: DatePickerFieldProps<TFieldValues, TName>) {
  const [open, setOpen] = React.useState(false)

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const selectedDate = parseLocalDate(field.value)
        const displayPlaceholder = placeholder ?? copy.placeholder ?? "YYYY-MM-DD"

        const handleSelect = (date: Date | undefined) => {
          if (!date) {
            field.onChange("")
          } else {
            const formatted = format(date, "yyyy-MM-dd")
            field.onChange(formatted)
          }
          setOpen(false)
        }

        const handleClear = (e: React.MouseEvent) => {
          e.stopPropagation()
          field.onChange("")
        }

        return (
          <Field data-invalid={fieldState.invalid} className={className}>
            {action ? (
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor={field.name}>{copy.label}</FieldLabel>
                {action}
              </div>
            ) : (
              <FieldLabel htmlFor={field.name}>{copy.label}</FieldLabel>
            )}

            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger
                render={
                  <Button
                    id={field.name}
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    aria-invalid={fieldState.invalid}
                    className={cn(
                      "w-full justify-between font-normal text-start",
                      !selectedDate && "text-muted-foreground",
                      fieldState.invalid && "border-destructive ring-destructive/20"
                    )}
                  />
                }
              >
                <span className="flex items-center gap-2 truncate">
                  <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">
                    {selectedDate ? format(selectedDate, "yyyy-MM-dd") : displayPlaceholder}
                  </span>
                </span>

                <span className="flex items-center gap-1">
                  {clearable && selectedDate && !disabled && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Clear date"
                      onClick={handleClear}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          handleClear(e as any)
                        }
                      }}
                      className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X className="size-3.5" aria-hidden />
                    </span>
                  )}
                </span>
              </PopoverTrigger>

              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleSelect}
                  disabled={
                    disabled
                      ? true
                      : (date) => {
                          if (minDate && date < minDate) return true
                          if (maxDate && date > maxDate) return true
                          return false
                        }
                  }
                  autoFocus
                />
              </PopoverContent>
            </Popover>

            {copy.description && (
              <FieldDescription>{copy.description}</FieldDescription>
            )}

            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )
      }}
    />
  )
}
