/** Pure customer payment rules shared by the API and the web app. Amounts are integer minor units. */

export const sumCustomerAllocations = (allocations: readonly { amountMinor: string }[]): bigint =>
  allocations.reduce((sum, a) => sum + BigInt(a.amountMinor), 0n)
