export const GeoErrorCode = {
  COUNTRY_NOT_FOUND: "COUNTRY_NOT_FOUND",
  STATE_NOT_FOUND: "STATE_NOT_FOUND",
  CURRENCY_NOT_FOUND: "CURRENCY_NOT_FOUND",
  TIMEZONE_NOT_FOUND: "TIMEZONE_NOT_FOUND",
} as const

export type GeoErrorCode = (typeof GeoErrorCode)[keyof typeof GeoErrorCode]
