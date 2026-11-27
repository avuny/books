import type { Context } from "hono"
import { createMiddleware } from "hono/factory"
import { getCookie, setCookie, deleteCookie } from "hono/cookie"
import {
  PLATFORM_AUTH_COOKIE_NAME,
  PLATFORM_AUTH_COOKIE_PATH,
  PlatformAuthErrorCode,
} from "@avuny/contracts/platform-admin"
import type { PlatformAdmin, PlatformAdminSession, DB } from "@avuny/db"
import { config } from "../../config.js"
import { resolveSession } from "./platform-auth.service.js"

/**
 * Platform session cookie and auth middleware (A1-04). Separate identity from the
 * tenant app (PLATFORM-ADMIN-SPEC 2.4): __Host- cookie name, its own sessions
 * table, its own secrets. A tenant session cookie is simply unknown here.
 */

export interface PlatformAuthEnv {
  Variables: {
    platformAdmin: PlatformAdmin
    platformAdminSession: PlatformAdminSession
  }
}

export const getRequestContext = (c: Context) => ({
  ipAddress:
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    null,
  userAgent: c.req.header("user-agent") ?? null,
})

export function setSessionCookie(c: Context, token: string, expiresAt: Date): void {
  setCookie(c, PLATFORM_AUTH_COOKIE_NAME, token, {
    path: PLATFORM_AUTH_COOKIE_PATH,
    httpOnly: true,
    // __Host- requires Secure; localhost counts as a secure context in dev.
    secure: true,
    sameSite: config.COOKIE_SAMESITE === "none" ? "None" : config.COOKIE_SAMESITE === "lax" ? "Lax" : "Strict",
    expires: expiresAt,
  })
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, PLATFORM_AUTH_COOKIE_NAME, { path: PLATFORM_AUTH_COOKIE_PATH })
}

const unauthenticated = (c: Context) =>
  c.json(
    {
      success: false as const,
      type: "domain" as const,
      code: PlatformAuthErrorCode.UNAUTHENTICATED,
      message: "Authentication required",
    },
    401
  )

/**
 * Requires a live platform admin session. Sets `platformAdmin` and
 * `platformAdminSession` on the context. A tenant token, a garbage cookie or an
 * expired/revoked session all get the same 401 (PAC2).
 */
export const createRequirePlatformAuth = (db: DB) =>
  createMiddleware<PlatformAuthEnv>(async (c, next) => {
    const token = getCookie(c, PLATFORM_AUTH_COOKIE_NAME)
    if (!token) return unauthenticated(c)
    const resolved = await resolveSession(db, token)
    if (!resolved) {
      clearSessionCookie(c)
      return unauthenticated(c)
    }
    c.set("platformAdmin", resolved.admin)
    c.set("platformAdminSession", resolved.session)
    await next()
  })
