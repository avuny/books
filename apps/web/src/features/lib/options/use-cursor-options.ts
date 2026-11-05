/**
 * apps/web/src/lib/options/use-cursor-options.ts (new)
 *
 * Turns any `*-options` endpoint into an `AsyncOptionsSource` for AsyncCombobox: debounced search,
 * cursor pagination, a cache entry per search term, and nothing fetched until the list is first opened.
 * It never sees the generated client; each module passes its own `fetchPage`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query"
import type { OptionListResponse } from "@avuny/contracts"
import type {
  AsyncOptionsSource,
  ComboboxOption,
} from "@workspace/ui/blocks/form"

export type FetchOptionsPage = (args: {
  cursor: string | undefined
  /** Already trimmed; undefined when the box is empty (the API rejects an empty string). */
  search: string | undefined
  limit: number
  signal: AbortSignal
}) => Promise<OptionListResponse>

export type UseCursorOptionsArgs = {
  /**
   * Cache prefix, e.g. `getListRoleOptionsQueryKey(orgId)`. Every search and page lives under it, so
   * `queryClient.invalidateQueries({ queryKey })` after a create, rename or delete refreshes them all.
   */
  queryKey: readonly unknown[]
  fetchPage: FetchOptionsPage
  limit?: number
  debounceMs?: number
  /** How long a result counts as fresh: reopening the list or retyping a recent search costs no request. */
  staleTime?: number
  enabled?: boolean
}

export function useCursorOptions({
  queryKey,
  fetchPage,
  limit = 20,
  debounceMs = 300,
  staleTime = 60_000,
  enabled = true,
}: UseCursorOptionsArgs): AsyncOptionsSource {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("") // what the user typed
  const [committed, setCommitted] = useState("") // what we query, after the debounce
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const onSearchChange = useCallback(
    (text: string) => {
      const next = text.trim()
      setSearch(next)
      clearTimeout(timer.current)
      // Clearing the box applies at once (back to the cached default list); typing waits for a pause.
      if (next === "") setCommitted("")
      else timer.current = setTimeout(() => setCommitted(next), debounceMs)
    },
    [debounceMs]
  )

  useEffect(() => () => clearTimeout(timer.current), [])

  const onOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next)
      if (!next) onSearchChange("") // reopen on the full list, not on the last search
    },
    [onSearchChange]
  )

  const query = useInfiniteQuery({
    queryKey: [...queryKey, "infinite", { search: committed, limit }],
    queryFn: ({ pageParam, signal }) =>
      fetchPage({ cursor: pageParam, search: committed || undefined, limit, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: enabled && open,
    staleTime,
    placeholderData: keepPreviousData, // keep the old list on screen while a new search loads
  })

  const options = useMemo(() => {
    // Keyset pages don't overlap, but a stale cursor restarts at page one: dedupe by id to be safe.
    const byId = new Map<string, ComboboxOption>()
    for (const page of query.data?.pages ?? []) {
      for (const item of page.items) byId.set(item.id, item)
    }
    return [...byId.values()]
  }, [query.data])

  const { fetchNextPage, refetch } = query
  const loadMore = useCallback(() => void fetchNextPage(), [fetchNextPage])
  const retry = useCallback(() => void refetch(), [refetch])

  return {
    options,
    isLoading: query.isLoading,
    isSearching: search !== committed || query.isPlaceholderData,
    isError: query.isError,
    // Never page through the previous search's cursor while its results are only a placeholder.
    hasNextPage: query.hasNextPage && !query.isPlaceholderData,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: loadMore,
    retry,
    search,
    onSearchChange,
    onOpenChange,
  }
}
