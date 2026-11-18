import Cookies from "js-cookie"
import type { InternalAxiosRequestConfig } from "axios"

import { tokenStorage } from "../auth/token-storage"
import { API_CONFIG } from "../config"
import i18n from "@/i18n/i18n"
import { defaultLocale, isLocale } from "@avuny/i18n"

export function requestInterceptor(config: InternalAxiosRequestConfig) {
  attachAccessToken(config)

  attachOrganizationId(config)

  attachLanguage(config)

  return config
}

function attachAccessToken(config: InternalAxiosRequestConfig) {
  const existingAuthHeader =
    (typeof config.headers.get === "function"
      ? config.headers.get("Authorization")
      : config.headers.Authorization) as string | undefined

  const hasValidAuthHeader =
    typeof existingAuthHeader === "string" &&
    existingAuthHeader.toLowerCase().startsWith("bearer ") &&
    !existingAuthHeader.includes("undefined") &&
    !existingAuthHeader.includes("null")

  if (hasValidAuthHeader) {
    return
  }

  const token = tokenStorage.getAccessToken()

  if (token) {
    if (typeof config.headers.set === "function") {
      config.headers.set("Authorization", `Bearer ${token}`)
    } else {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
}

function attachOrganizationId(config: InternalAxiosRequestConfig) {
  const organizationId = Cookies.get("selectedOrganizationId")

  if (!organizationId) {
    return
  }

  config.headers[API_CONFIG.headers.organizationId] = organizationId
}

export function attachLanguage(
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig {
  const currentLocale = i18n.resolvedLanguage ?? i18n.language

  const locale = isLocale(currentLocale) ? currentLocale : defaultLocale

  config.headers.set(API_CONFIG.headers.language, locale)

  return config
}
