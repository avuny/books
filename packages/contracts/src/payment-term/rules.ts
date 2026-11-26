import type { PaymentTermMethod } from "./constants.js"

/** `YYYY-MM-DD` arithmetic done in UTC so a date-only value never shifts a calendar day. */
const parse = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d))
}
const fmt = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000)
const endOfMonth = (d: Date, monthsAhead = 0) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + monthsAhead + 1, 0))

/** Due date for a document dated `invoiceDate` (SPEC 7.4). Pure and runtime-agnostic. */
export function computeDueDate(
  invoiceDate: string,
  term: { method: PaymentTermMethod; days: number }
): string {
  const base = parse(invoiceDate)
  switch (term.method) {
    case "DUE_ON_RECEIPT":
      return fmt(base)
    case "NET_DAYS":
      return fmt(addDays(base, term.days))
    case "END_OF_MONTH":
      return fmt(endOfMonth(base))
    case "END_OF_NEXT_MONTH":
      return fmt(endOfMonth(base, 1))
    case "DAYS_AFTER_END_OF_MONTH":
      return fmt(addDays(endOfMonth(base), term.days))
  }
}
