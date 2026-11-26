export interface SelectOptionLike {
  value: string
}

/**
 * Default currency for a chosen country: the country's own currency, but only when it is one of
 * the selectable options. Otherwise keep what is selected now.
 */
export function pickCurrency(
  countryCurrency: string | null | undefined,
  currencyOptions: readonly SelectOptionLike[],
  current: string
): string {
  if (!countryCurrency) return current
  return currencyOptions.some((o) => o.value === countryCurrency)
    ? countryCurrency
    : current
}

/**
 * Timezone after a country is chosen: keep the current one if it belongs to the country's list,
 * otherwise use the first timezone of that list. An empty list changes nothing.
 */
export function pickTimezone(
  timezoneOptions: readonly SelectOptionLike[],
  current: string
): string {
  if (timezoneOptions.length === 0) return current
  return timezoneOptions.some((o) => o.value === current)
    ? current
    : timezoneOptions[0]!.value
}
