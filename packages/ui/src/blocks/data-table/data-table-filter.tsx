"use client"

import * as React from "react"
import { ListFilter } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
import { cn } from "@workspace/ui/lib/utils"

import {
  cleanFilterValues,
  countActiveFilters,
} from "./data-table-filter-utils"
import type {
  DateRangeValue,
  FilterField,
  FilterOption,
  FilterValue,
  FilterValues,
  NumberRangeValue,
} from "./data-table-types"

export interface DataTableFilterCopy {
  /** Trigger button label, e.g. "Filter". */
  triggerLabel: string
  title: string
  description?: string
  applyLabel: string
  resetLabel: string
}

export interface DataTableFilterProps {
  /** Module-specific attributes. This is the only thing that changes per module. */
  fields: FilterField[]
  /** Currently applied values. */
  value: FilterValues
  onApply: (values: FilterValues) => void
  copy: DataTableFilterCopy
  className?: string
}

/**
 * Filter trigger + panel. Desktop (md+): popover. Mobile: bottom sheet.
 * Both triggers are always in the tree and toggled with CSS, so there is no
 * JS media query and no hydration mismatch.
 */
export function DataTableFilter({
  fields,
  value,
  onApply,
  copy,
  className,
}: DataTableFilterProps) {
  const [popoverOpen, setPopoverOpen] = React.useState(false)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const activeCount = countActiveFilters(value)

  const renderTrigger = (triggerClassName: string) => (
    <Button
      type="button"
      variant="outline"
      className={cn("gap-2", triggerClassName, className)}
    >
      <ListFilter className="size-4" aria-hidden />
      <span>{copy.triggerLabel}</span>
      {activeCount > 0 ? (
        <span className="min-w-5 rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground tabular-nums">
          {activeCount}
        </span>
      ) : null}
    </Button>
  )

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger render={renderTrigger("hidden md:inline-flex")} />
        <PopoverContent align="end" className="w-[24rem] gap-0 p-0">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-medium text-foreground">{copy.title}</p>
            {copy.description ? (
              <p className="text-xs text-muted-foreground">
                {copy.description}
              </p>
            ) : null}
          </div>
          <FilterPanel
            fields={fields}
            value={value}
            copy={copy}
            onApply={onApply}
            onDone={() => setPopoverOpen(false)}
          />
        </PopoverContent>
      </Popover>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger render={renderTrigger("md:hidden")} />
        <SheetContent side="bottom" className="gap-0 rounded-t-xl p-0">
          <SheetHeader className="border-b border-border">
            <SheetTitle>{copy.title}</SheetTitle>
            {copy.description ? (
              <SheetDescription>{copy.description}</SheetDescription>
            ) : null}
          </SheetHeader>
          <FilterPanel
            fields={fields}
            value={value}
            copy={copy}
            onApply={onApply}
            onDone={() => setSheetOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Panel (draft state lives here; it mounts fresh every time the panel opens) */
/* -------------------------------------------------------------------------- */

interface FilterPanelProps {
  fields: FilterField[]
  value: FilterValues
  copy: DataTableFilterCopy
  onApply: (values: FilterValues) => void
  onDone: () => void
}

function FilterPanel({
  fields,
  value,
  copy,
  onApply,
  onDone,
}: FilterPanelProps) {
  const [draft, setDraft] = React.useState<FilterValues>(value)

  const setField = (id: string, next: FilterValue | undefined) =>
    setDraft((prev) => ({ ...prev, [id]: next }))

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    onApply(cleanFilterValues(draft))
    onDone()
  }

  const handleReset = () => {
    setDraft({})
    onApply({})
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
      <div className="grid max-h-[60dvh] gap-5 overflow-y-auto p-4">
        {fields.map((field) => (
          <FilterFieldControl
            key={field.id}
            field={field}
            value={draft[field.id]}
            onChange={(next) => setField(field.id, next)}
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border p-4">
        <Button type="button" variant="ghost" onClick={handleReset}>
          {copy.resetLabel}
        </Button>
        <Button type="submit">{copy.applyLabel}</Button>
      </div>
    </form>
  )
}

/* -------------------------------------------------------------------------- */
/* Field controls                                                             */
/* -------------------------------------------------------------------------- */

interface FilterFieldControlProps {
  field: FilterField
  value: FilterValue | undefined
  onChange: (value: FilterValue | undefined) => void
}

function FilterFieldControl({
  field,
  value,
  onChange,
}: FilterFieldControlProps) {
  const baseId = React.useId()

  switch (field.type) {
    case "text":
      return (
        <div className="grid gap-2">
          <Label htmlFor={baseId}>{field.label}</Label>
          <Input
            id={baseId}
            value={typeof value === "string" ? value : ""}
            placeholder={field.placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      )

    case "select":
      return (
        <div className="grid gap-2">
          <span className="text-sm font-medium text-foreground">
            {field.label}
          </span>
          <OptionChips
            label={field.label}
            options={field.options}
            selected={typeof value === "string" && value ? [value] : []}
            onChange={(next) => onChange(next[0])}
            multiple={false}
          />
        </div>
      )

    case "multiselect":
      return (
        <div className="grid gap-2">
          <span className="text-sm font-medium text-foreground">
            {field.label}
          </span>
          <OptionChips
            label={field.label}
            options={field.options}
            selected={Array.isArray(value) ? value : []}
            onChange={(next) => onChange(next)}
            multiple
          />
        </div>
      )

    case "number-range": {
      const range = (
        typeof value === "object" && !Array.isArray(value) && value ? value : {}
      ) as NumberRangeValue
      return (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium text-foreground">
            {field.label}
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label
                htmlFor={`${baseId}-min`}
                className="text-xs text-muted-foreground"
              >
                {field.minLabel}
              </Label>
              <Input
                id={`${baseId}-min`}
                type="number"
                inputMode="decimal"
                value={range.min ?? ""}
                onChange={(event) =>
                  onChange({ ...range, min: event.target.value })
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label
                htmlFor={`${baseId}-max`}
                className="text-xs text-muted-foreground"
              >
                {field.maxLabel}
              </Label>
              <Input
                id={`${baseId}-max`}
                type="number"
                inputMode="decimal"
                value={range.max ?? ""}
                onChange={(event) =>
                  onChange({ ...range, max: event.target.value })
                }
              />
            </div>
          </div>
        </fieldset>
      )
    }

    case "date-range": {
      const range = (
        typeof value === "object" && !Array.isArray(value) && value ? value : {}
      ) as DateRangeValue
      return (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium text-foreground">
            {field.label}
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label
                htmlFor={`${baseId}-from`}
                className="text-xs text-muted-foreground"
              >
                {field.fromLabel}
              </Label>
              <Input
                id={`${baseId}-from`}
                type="date"
                value={range.from ?? ""}
                onChange={(event) =>
                  onChange({ ...range, from: event.target.value })
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label
                htmlFor={`${baseId}-to`}
                className="text-xs text-muted-foreground"
              >
                {field.toLabel}
              </Label>
              <Input
                id={`${baseId}-to`}
                type="date"
                value={range.to ?? ""}
                onChange={(event) =>
                  onChange({ ...range, to: event.target.value })
                }
              />
            </div>
          </div>
        </fieldset>
      )
    }
  }
}

interface OptionChipsProps {
  label: string
  options: FilterOption[]
  selected: string[]
  multiple: boolean
  onChange: (selected: string[]) => void
}

/** Touch-friendly toggle chips used for select / multiselect fields. */
function OptionChips({
  label,
  options,
  selected,
  multiple,
  onChange,
}: OptionChipsProps) {
  const toggle = (optionValue: string) => {
    const isActive = selected.includes(optionValue)
    if (multiple) {
      onChange(
        isActive
          ? selected.filter((v) => v !== optionValue)
          : [...selected, optionValue]
      )
    } else {
      onChange(isActive ? [] : [optionValue])
    }
  }

  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selected.includes(option.value)
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(option.value)}
            className={cn(
              "h-8 rounded-full border px-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-muted"
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
