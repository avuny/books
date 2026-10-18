import i18next from "i18next"
import otpEn from "./locales/otp/en.json" with { type: "json" }
import otpAr from "./locales/otp/ar.json" with { type: "json" }
import authEn from "./locales/auth/en.json" with { type: "json" }
import authAr from "./locales/auth/ar.json" with { type: "json" }
import usersEn from "./locales/users/en.json" with { type: "json" }
import usersAr from "./locales/users/ar.json" with { type: "json" }
import adminEn from "./locales/admin/en.json" with { type: "json" }
import adminAr from "./locales/admin/ar.json" with { type: "json" }

/**
 * Call once at startup. Never call i18n.changeLanguage() on the server: it is global and races
 * between concurrent requests. Use trans({ lang }) (= i18next.getFixedT) for every translation.
 */
export function installRequestLanguage(): void {
  i18next.init({
    lng: "en",
    fallbackLng: "en",
    ns: ["otp", "auth", "users", "admin"],
    defaultNS: "otp",
    resources: {
      en: {
        otp: otpEn,
        auth: authEn,
        users: usersEn,
        admin: adminEn,
      },
      ar: {
        otp: otpAr,
        auth: authAr,
        users: usersAr,
        admin: adminAr,
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
export function trans({ lang }: { lang: string }) {
  return (key: string): string => i18next.t(key, { lng: lang })
}
