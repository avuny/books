import { GeoErrorCode } from "@avuny/contracts"
import type { ErrorMeta } from "@avuny/utils"

export { GeoErrorCode }

export const geoErrorsHttpMap = {
  COUNTRY_NOT_FOUND: {
    statusCode: 404,
    responseMessage: "Country not found",
  },
  STATE_NOT_FOUND: {
    statusCode: 404,
    responseMessage: "State or province not found",
  },
  CURRENCY_NOT_FOUND: {
    statusCode: 404,
    responseMessage: "Currency not found",
  },
  TIMEZONE_NOT_FOUND: {
    statusCode: 404,
    responseMessage: "Timezone not found",
  },
} as const satisfies Record<GeoErrorCode, ErrorMeta>
