import { createOpenAPIRouter } from "@avuny/hono"
import countryListRoute from "./country-list.route.js"
import getCountryRoute from "./get-country.route.js"
import stateListRoute from "./state-list.route.js"
import countryStatesRoute from "./country-states.route.js"
import currencyListRoute from "./currency-list.route.js"
import timezoneListRoute from "./timezone-list.route.js"

export const geoRoutes = createOpenAPIRouter()

geoRoutes.route("/", countryListRoute)
geoRoutes.route("/", getCountryRoute)
geoRoutes.route("/", stateListRoute)
geoRoutes.route("/", countryStatesRoute)
geoRoutes.route("/", currencyListRoute)
geoRoutes.route("/", timezoneListRoute)
