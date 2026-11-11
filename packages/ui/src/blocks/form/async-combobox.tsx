/**
 * @workspace/ui/blocks/form/async-combobox.tsx (new; export it from blocks/form)
 *
 * Server-driven combobox: the list is whatever `source` says it is, so this file knows nothing about
 * roles, react-hook-form, i18n or the API. It is built on shadcn's Base UI `combobox`
 * (`pnpm dlx shadcn@latest add combobox` if you don't have it yet) and is the only file that touches
 * that component's props. If a prop name differs in your version, this is the one place to fix.
 */
import * as React from "react"
import { Loader2, Pencil, Plus } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@workspace/ui/components/combobox"
import { cn } from "@workspace/ui/lib/utils"

export type ComboboxOption = { id: string; name: string }

/** Everything the combobox needs from a data source. `useCursorOptions` builds one from any *-options endpoint. */
export type AsyncOptionsSource = {
  options: ComboboxOption[]
  /** The first page is loading and there is nothing to show yet. */
  isLoading: boolean
  /** Stale options are on screen while a new search is pending or in flight. */
  isSearching: boolean
  isError: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  retry: () => void
  /** What the user typed (trimmed). The source debounces it before querying. */
  search: string
  onSearchChange: (text: string) => void
  /** Lets the source stay idle until the list is first opened, and reset the search on close. */
  onOpenChange: (open: boolean) => void
}

export type AsyncComboboxCopy = {
  loading: string
  loadingMore: string
  empty: string
  error: string
  retry: string
}

export type ComboboxCreateAction = {
  label: string
  /**
   * Runs when the footer button is pressed (the list closes first). Open your create UI here and call
   * `select(option)` once the item exists: it picks that option and sets the form value.
   * `search` is what the user had typed, handy for prefilling a name.
   */
  onClick: (ctx: {
    search: string
    select: (option: ComboboxOption) => void
  }) => void
}

export type ComboboxEditAction = {
  label?: string
  /**
   * Runs when the edit icon on an item is clicked (the list closes first).
   * Opens the existing edit/update dialog for that option.
   */
  onEdit: (option: ComboboxOption) => void
}

export type AsyncComboboxProps = {
  id?: string
  /** Selected id. null or "" means nothing is selected. */
  value: string | null
  onValueChange: (id: string | null) => void
  onBlur?: () => void
  inputRef?: React.Ref<HTMLInputElement>
  source: AsyncOptionsSource
  copy: AsyncComboboxCopy
  placeholder?: string
  /** Label for an id that is already selected (edit forms), so it shows before any page has loaded. */
  initialOption?: ComboboxOption | null
  createAction?: ComboboxCreateAction
  editAction?: ComboboxEditAction
  onEditOption?: (option: ComboboxOption) => void
  disabled?: boolean
  invalid?: boolean
}

/** Load the next page when the list is this close to its end. */
const LOAD_MORE_THRESHOLD_PX = 48

export function AsyncCombobox({
  id,
  value,
  onValueChange,
  onBlur,
  inputRef,
  source,
  copy,
  placeholder,
  initialOption,
  createAction,
  editAction,
  onEditOption,
  disabled,
  invalid,
}: AsyncComboboxProps) {
  const { options, hasNextPage, isFetchingNextPage, fetchNextPage } = source
  const onSourceOpenChange = source.onOpenChange
  const [open, setOpen] = React.useState(false)
  // The list is paged and filtered, so the chosen option may not be in `options`: remember it here.
  const [picked, setPicked] = React.useState<ComboboxOption | null>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  const editHandler = editAction?.onEdit ?? onEditOption
  const editLabel = editAction?.label ?? "Edit"

  const selected = React.useMemo(
    () =>
      value
        ? ([picked, initialOption, ...options].find((o) => o?.id === value) ??
          null)
        : null,
    [value, picked, initialOption, options]
  )

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      setOpen(next)
      onSourceOpenChange(next)
    },
    [onSourceOpenChange]
  )

  const handleValueChange = React.useCallback(
    (option: ComboboxOption | null) => {
      setPicked(option)
      onValueChange(option?.id ?? null)
    },
    [onValueChange]
  )

  /** Handed to `createAction.onClick`: pick a freshly created option and close the list. */
  const select = React.useCallback(
    (option: ComboboxOption) => {
      handleValueChange(option)
      handleOpenChange(false)
    },
    [handleValueChange, handleOpenChange]
  )

  const loadMoreIfNearEnd = React.useCallback(() => {
    const list = listRef.current
    if (!list || !hasNextPage || isFetchingNextPage) return
    const distanceToEnd = list.scrollHeight - list.scrollTop - list.clientHeight
    if (distanceToEnd <= LOAD_MORE_THRESHOLD_PX) fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // A short page may not overflow the list, so no scroll event would ever fire: top it up.
  React.useEffect(() => {
    if (open) loadMoreIfNearEnd()
  }, [open, options.length, loadMoreIfNearEnd])

  return (
    <Combobox
      items={options}
      value={selected}
      onValueChange={handleValueChange}
      open={open}
      onOpenChange={handleOpenChange}
      itemToStringLabel={(option) => option.name}
      isItemEqualToValue={(a, b) => a.id === b.id}
      filter={null} // the server already filtered; don't filter a second time here
      autoHighlight
      disabled={disabled}
    >
      <ComboboxInput
        ref={inputRef}
        id={id}
        placeholder={placeholder}
        aria-invalid={invalid}
        onBlur={onBlur}
        // Typing only. Base UI also rewrites the text when you pick an item or close the list,
        // and those programmatic changes must not trigger a search.
        onChange={(event) => source.onSearchChange(event.target.value)}
      />

      <ComboboxContent>
        <ComboboxEmpty>
          {source.isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              {copy.loading}
            </span>
          ) : source.isError ? (
            <ErrorStatus copy={copy} onRetry={source.retry} />
          ) : (
            copy.empty
          )}
        </ComboboxEmpty>

        <ComboboxList
          ref={listRef}
          aria-busy={source.isSearching}
          onScroll={loadMoreIfNearEnd}
          className={cn("max-h-60", source.isSearching && "opacity-60")}
        >
          {(option: ComboboxOption) => (
            <ComboboxItem
              key={option.id}
              value={option}
              className="group/combobox-item justify-between"
            >
              <span className="flex-1 truncate">{option.name}</span>
              {editHandler && (
                <button
                  type="button"
                  aria-label={editLabel}
                  className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground opacity-70 transition-opacity group-hover/combobox-item:opacity-100 hover:bg-accent hover:text-foreground"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    handleOpenChange(false)
                    editHandler(option)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation()
                      e.preventDefault()
                      handleOpenChange(false)
                      editHandler(option)
                    }
                  }}
                >
                  <Pencil className="size-3.5" aria-hidden />
                </button>
              )}
            </ComboboxItem>
          )}
        </ComboboxList>

        {options.length > 0 && (isFetchingNextPage || source.isError) && (
          <div
            role="status"
            className="flex items-center justify-center gap-2 px-2 py-2 text-xs text-muted-foreground"
          >
            {source.isError ? (
              <ErrorStatus copy={copy} onRetry={source.retry} />
            ) : (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                {copy.loadingMore}
              </>
            )}
          </div>
        )}

        {createAction && (
          <div className="border-t p-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
              onMouseDown={(event) => event.preventDefault()} // keep focus in the input
              onClick={() => {
                const { search } = source
                handleOpenChange(false)
                createAction.onClick({ search, select })
              }}
            >
              <Plus className="size-4" aria-hidden />
              {createAction.label}
            </Button>
          </div>
        )}
      </ComboboxContent>
    </Combobox>
  )
}

function ErrorStatus({
  copy,
  onRetry,
}: {
  copy: AsyncComboboxCopy
  onRetry: () => void
}) {
  return (
    <span className="flex items-center justify-center gap-2">
      {copy.error}
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto p-0"
        onClick={onRetry}
      >
        {copy.retry}
      </Button>
    </span>
  )
}
