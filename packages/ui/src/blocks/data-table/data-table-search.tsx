"use client"

import * as React from "react"
import { Search, X } from "lucide-react"

import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

export interface DataTableSearchProps {
  /** The applied search term. */
  value: string
  /** Called after the user stops typing (or presses Enter). */
  onChange: (value: string) => void
  placeholder: string
  clearLabel: string
  debounceMs?: number
  className?: string
}

export function DataTableSearch({
  value,
  onChange,
  placeholder,
  clearLabel,
  debounceMs = 300,
  className,
}: DataTableSearchProps) {
  const [local, setLocal] = React.useState(value)

  // Follow external changes (e.g. "clear all filters").
  React.useEffect(() => {
    setLocal(value)
  }, [value])

  // Debounced commit.
  React.useEffect(() => {
    if (local === value) return
    const id = window.setTimeout(() => onChange(local), debounceMs)
    return () => window.clearTimeout(id)
  }, [local, value, onChange, debounceMs])

  return (
    <div className={cn("relative w-full md:max-w-sm", className)}>
      <Search
        className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        value={local}
        inputMode="search"
        enterKeyHint="search"
        placeholder={placeholder}
        aria-label={placeholder}
        className="ps-9 pe-9"
        onChange={(event) => setLocal(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onChange(local)
        }}
      />
      {local ? (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={() => {
            setLocal("")
            onChange("")
          }}
          className="absolute end-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  )
}
