import type { Context } from "hono"
import { getCookie, setCookie, deleteCookie } from "hono/cookie"
import { config } from "../../../config.js"

const REFRESH_COOKIE_NAME = "refresh_token"
const REFRESH_COOKIE_PATH = "/api/auth"

export function getClientPlatform(c: Context): "web" | "mobile" {
  const platformHeader = c.req.header("x-client-platform")
  return platformHeader?.toLowerCase() === "mobile" ? "mobile" : "web"
}

export function setRefreshTokenCookie(c: Context, refreshToken: string): void {
  const isSecure =
    config.NODE_ENV === "production" || config.COOKIE_SAMESITE === "none"

  setCookie(c, REFRESH_COOKIE_NAME, refreshToken, {
    path: REFRESH_COOKIE_PATH,
    httpOnly: true,
    secure: isSecure,
    sameSite:
      config.COOKIE_SAMESITE === "none"
        ? "None"
        : config.COOKIE_SAMESITE === "strict"
          ? "Strict"
          : "Lax",
    domain: config.COOKIE_DOMAIN || undefined,
    maxAge: config.REFRESH_TOKEN_TTL,
  })
}

export function clearRefreshTokenCookie(c: Context): void {
  deleteCookie(c, REFRESH_COOKIE_NAME, {
    path: REFRESH_COOKIE_PATH,
    domain: config.COOKIE_DOMAIN || undefined,
  })
}

export function getRefreshTokenFromCookie(c: Context): string | undefined {
  return getCookie(c, REFRESH_COOKIE_NAME)
}
