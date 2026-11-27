/** Pure sales credit note rules shared by the API and the web app. Amounts are integer minor units. */

/**
 * Splits a gross credit into net and output tax in the same proportion as the invoice it corrects.
 * Tax is rounded half up; net is the remainder, so net + tax always equals the gross credit.
 * A credit for the full invoice total therefore reverses exactly the invoice's tax.
 */
export function splitCreditAmount(invoiceTaxMinor: string, invoiceTotalMinor: string, grossMinor: string): { net: bigint; tax: bigint } {
  const gross = BigInt(grossMinor)
  const total = BigInt(invoiceTotalMinor)
  if (total <= 0n) return { net: gross, tax: 0n }
  const tax = (gross * BigInt(invoiceTaxMinor) * 2n + total) / (total * 2n)
  return { net: gross - tax, tax }
}
