import Cookies from "js-cookie"
import type { InternalAxiosRequestConfig } from "axios"

import { tokenStorage } from "../auth/token-storage"
import { API_CONFIG } from "../config"

export function requestInterceptor(config: InternalAxiosRequestConfig) {
  attachAccessToken(config)

  attachOrganizationId(config)

  attachLanguage(config)

  return config
}

function attachAccessToken(config: InternalAxiosRequestConfig) {
  const hasAuthorizationHeader =
    typeof config.headers.Authorization === "string" &&
    config.headers.Authorization.toLowerCase().startsWith("bearer")

  if (hasAuthorizationHeader) {
    return
  }

  const token = tokenStorage.getAccessToken()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
}

function attachOrganizationId(config: InternalAxiosRequestConfig) {
  const organizationId = Cookies.get("selectedOrganizationId")

  if (!organizationId) {
    return
  }

  config.headers[API_CONFIG.headers.organizationId] = organizationId
}

function attachLanguage(config: InternalAxiosRequestConfig) {
  const language = Cookies.get("locale") || "en"

  config.headers[API_CONFIG.headers.language] = language
}
