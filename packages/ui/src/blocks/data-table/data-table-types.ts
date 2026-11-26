import type { ReactNode } from "react"
import type { RowData } from "@tanstack/react-table"

/**
 * Extra, optional column metadata understood by <DataTable />.
 * Use `meta: { headerClassName, cellClassName }` on any column def.
 */
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    headerClassName?: string
    cellClassName?: string
  }
}

/* -------------------------------------------------------------------------- */
/* Row actions                                                                */
/* -------------------------------------------------------------------------- */

export interface RowAction {
  id: string
  /** Already-translated label. */
  label: string
  icon?: ReactNode
  onSelect: () => void
  variant?: "default" | "destructive"
  disabled?: boolean
  /** Render a separator above this item (e.g. before "Delete"). */
  separatorBefore?: boolean
}

/* -------------------------------------------------------------------------- */
/* Filters                                                                    */
/* -------------------------------------------------------------------------- */

export interface FilterOption {
  value: string
  /** Already-translated label. */
  label: string
}

interface BaseFilterField {
  /** Key used in the FilterValues object (usually the API query param). */
  id: string
  /** Already-translated label. */
  label: string
}

export interface TextFilterField extends BaseFilterField {
  type: "text"
  placeholder?: string
}

export interface SelectFilterField extends BaseFilterField {
  type: "select"
  options: FilterOption[]
}

export interface MultiSelectFilterField extends BaseFilterField {
  type: "multiselect"
  options: FilterOption[]
}

export interface NumberRangeFilterField extends BaseFilterField {
  type: "number-range"
  minLabel: string
  maxLabel: string
}

export interface DateRangeFilterField extends BaseFilterField {
  type: "date-range"
  fromLabel: string
  toLabel: string
}

export type FilterField =
  | TextFilterField
  | SelectFilterField
  | MultiSelectFilterField
  | NumberRangeFilterField
  | DateRangeFilterField

export interface NumberRangeValue {
  min?: string
  max?: string
}

export interface DateRangeValue {
  from?: string
  to?: string
}

export type FilterValue = string | string[] | NumberRangeValue | DateRangeValue

/** Keyed by FilterField.id. Empty values are stripped before onApply is called. */
export type FilterValues = Record<string, FilterValue | undefined>

export interface ActiveFilter {
  id: string
  label: string
  valueLabel: string
}
