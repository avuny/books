import i18next from "i18next"
import adminEn from "./locales/admin/en.json" with { type: "json" }
import adminAr from "./locales/admin/ar.json" with { type: "json" }
import authEn from "./locales/auth/en.json" with { type: "json" }
import authAr from "./locales/auth/ar.json" with { type: "json" }
import geoEn from "./locales/geo/en.json" with { type: "json" }
import geoAr from "./locales/geo/ar.json" with { type: "json" }
import organizationEn from "./locales/organization/en.json" with { type: "json" }
import organizationAr from "./locales/organization/ar.json" with { type: "json" }
import organizationInvitationEn from "./locales/organization-invitation/en.json" with { type: "json" }
import organizationInvitationAr from "./locales/organization-invitation/ar.json" with { type: "json" }
import organizationUserEn from "./locales/organization-user/en.json" with { type: "json" }
import organizationUserAr from "./locales/organization-user/ar.json" with { type: "json" }
import otpEn from "./locales/otp/en.json" with { type: "json" }
import otpAr from "./locales/otp/ar.json" with { type: "json" }
import roleEn from "./locales/role/en.json" with { type: "json" }
import roleAr from "./locales/role/ar.json" with { type: "json" }
import sidebarEn from "./locales/sidebar/en.json" with { type: "json" }
import sidebarAr from "./locales/sidebar/ar.json" with { type: "json" }
import usersEn from "./locales/users/en.json" with { type: "json" }
import usersAr from "./locales/users/ar.json" with { type: "json" }
import { Locale } from "@avuny/i18n"

export const resources = {
  en: {
        admin: adminEn,
        auth: authEn,
        geo: geoEn,
        organization: organizationEn,
        "organization-invitation": organizationInvitationEn,
        organizationInvitation: organizationInvitationEn,
        "organization-user": organizationUserEn,
        organizationUser: organizationUserEn,
        otp: otpEn,
        role: roleEn,
        sidebar: sidebarEn,
        users: usersEn,
  },
  ar: {
        admin: adminAr,
        auth: authAr,
        geo: geoAr,
        organization: organizationAr,
        "organization-invitation": organizationInvitationAr,
        organizationInvitation: organizationInvitationAr,
        "organization-user": organizationUserAr,
        organizationUser: organizationUserAr,
        otp: otpAr,
        role: roleAr,
        sidebar: sidebarAr,
        users: usersAr,
  },
} as const

export type Resources = (typeof resources)["en"]

/**
 * Call once at startup. Never call i18n.changeLanguage() on the server: it is global and races
 * between concurrent requests. Use trans({ lang }) (= i18next.getFixedT) for every translation.
 */
export function installRequestLanguage(): void {
  i18next.init({
    lng: "en",
    fallbackLng: "en",
    ns: ["admin", "auth", "geo", "organization", "organization-invitation", "organizationInvitation", "organization-user", "organizationUser", "otp", "role", "sidebar", "users"],
    defaultNS: "otp",
    resources,
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
  return (key: string): string => i18next.t(key as any, { lng: lang })
}
