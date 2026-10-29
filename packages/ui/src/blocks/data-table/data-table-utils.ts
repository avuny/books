export type PageItem = number | "ellipsis-start" | "ellipsis-end"

/**
 * Builds the page buttons for a paginator: first, last, current ± 1 and
 * ellipses. Always returns at most 7 items.
 */
export function getPageItems(page: number, pageCount: number): PageItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1)
  }

  const siblingsStart = Math.max(Math.min(page - 1, pageCount - 4), 3)
  const siblingsEnd = Math.min(Math.max(page + 1, 5), pageCount - 2)

  const items: PageItem[] = [1]
  items.push(siblingsStart > 3 ? "ellipsis-start" : 2)
  for (let p = siblingsStart; p <= siblingsEnd; p++) items.push(p)
  items.push(siblingsEnd < pageCount - 2 ? "ellipsis-end" : pageCount - 1)
  items.push(pageCount)
  return items
}

const INTERACTIVE_SELECTOR =
  "a,button,input,select,textarea,label,[role='checkbox'],[role='menuitem'],[role='button']"

/** True when a click came from a control inside a row (so row-click is skipped). */
export function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null
  )
}
