import type {
  ActiveFilter,
  DateRangeValue,
  FilterField,
  FilterValue,
  FilterValues,
  NumberRangeValue,
} from "./data-table-types"

export function isFilterValueEmpty(value: FilterValue | undefined): boolean {
  if (value === undefined) return true
  if (typeof value === "string") return value.trim() === ""
  if (Array.isArray(value)) return value.length === 0
  return Object.values(value).every((v) => v === undefined || v.trim() === "")
}

/** Removes empty entries so consumers never see `{ status: [] }`. */
export function cleanFilterValues(values: FilterValues): FilterValues {
  const result: FilterValues = {}
  for (const [key, value] of Object.entries(values)) {
    if (!isFilterValueEmpty(value)) result[key] = value
  }
  return result
}

export function countActiveFilters(values: FilterValues): number {
  return Object.values(values).filter((v) => !isFilterValueEmpty(v)).length
}

export function removeFilterValue(
  values: FilterValues,
  id: string
): FilterValues {
  const next = { ...values }
  delete next[id]
  return next
}

function formatRange(from?: string, to?: string): string {
  if (from && to) return `${from} – ${to}`
  if (from) return `≥ ${from}`
  if (to) return `≤ ${to}`
  return ""
}

/** Turns filter values into display chips (labels come from the fields). */
export function getActiveFilters(
  fields: FilterField[],
  values: FilterValues
): ActiveFilter[] {
  const result: ActiveFilter[] = []

  for (const field of fields) {
    const value = values[field.id]
    if (isFilterValueEmpty(value) || value === undefined) continue

    let valueLabel = ""
    switch (field.type) {
      case "text":
        valueLabel = value as string
        break
      case "select":
      case "multiselect": {
        const selected = Array.isArray(value) ? value : [value as string]
        valueLabel = selected
          .map((v) => field.options.find((o) => o.value === v)?.label ?? v)
          .join(", ")
        break
      }
      case "number-range": {
        const range = value as NumberRangeValue
        valueLabel = formatRange(range.min, range.max)
        break
      }
      case "date-range": {
        const range = value as DateRangeValue
        valueLabel = formatRange(range.from, range.to)
        break
      }
    }

    result.push({ id: field.id, label: field.label, valueLabel })
  }

  return result
}
