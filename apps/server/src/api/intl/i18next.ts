import i18next from "i18next"
import otpEn from "./locales/otp/en.json" with { type: "json" }
import otpAr from "./locales/otp/ar.json" with { type: "json" }
import authEn from "./locales/auth/en.json" with { type: "json" }
import authAr from "./locales/auth/ar.json" with { type: "json" }
import usersEn from "./locales/users/en.json" with { type: "json" }
import usersAr from "./locales/users/ar.json" with { type: "json" }
import adminEn from "./locales/admin/en.json" with { type: "json" }
import adminAr from "./locales/admin/ar.json" with { type: "json" }
import organizationEn from "./locales/organization/en.json" with { type: "json" }
import organizationAr from "./locales/organization/ar.json" with { type: "json" }
import geoEn from "./locales/geo/en.json" with { type: "json" }
import geoAr from "./locales/geo/ar.json" with { type: "json" }
import { Locale } from "@avuny/i18n"

/**
 * Call once at startup. Never call i18n.changeLanguage() on the server: it is global and races
 * between concurrent requests. Use trans({ lang }) (= i18next.getFixedT) for every translation.
 */
export function installRequestLanguage(): void {
  i18next.init({
    lng: "en",
    fallbackLng: "en",
    ns: ["otp", "auth", "users", "admin", "organization", "geo"],
    defaultNS: "otp",
    resources: {
      en: {
        otp: otpEn,
        auth: authEn,
        users: usersEn,
        admin: adminEn,
        organization: organizationEn,
        geo: geoEn,
      },
      ar: {
        otp: otpAr,
        auth: authAr,
        users: usersAr,
        admin: adminAr,
        organization: organizationAr,
        geo: geoAr,
      },
    },
    interpolation: { escapeValue: false },
  })
}

/**
 * Returns a fixed-t translator bound to the given language.
 * Use with handleResult's errorTrans param.
 *
 * @example
 *   const errorTrans = trans({ lang })
 *   // then pass errorTrans to handleResult
 */
export function trans({ lang }: { lang: Locale }) {
  return (key: string): string => i18next.t(key, { lng: lang })
}
