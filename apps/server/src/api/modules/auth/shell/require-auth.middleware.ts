import { createMiddleware } from "hono/factory"
import type { Session, User } from "@avuny/db"
import { db } from "../../../db.js"
import { verifyAccessToken } from "../core/auth.crypto.js"
import { findActiveSessionWithUser } from "./auth.repo.js"

export interface AuthContextEnv {
  Variables: {
    user: User
    session: Session
  }
}

/**
 * requireAuth middleware (D3):
 * 1. Verifies Bearer JWT access token
 * 2. Loads session and user from DB in one query by sid
 * 3. Rejects immediately if session is revoked/expired or user is not active
 * 4. Injects user and session into context variables
 */
export const requireAuth = createMiddleware<AuthContextEnv>(async (c, next) => {
  const authHeader = c.req.header("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json(
      {
        success: false,
        code: "INVALID_CREDENTIALS",
        message: "Authentication required",
        type: "domain",
      },
      401
    )
  }

  const token = authHeader.slice(7).trim()
  const payload = verifyAccessToken(token)
  if (!payload) {
    return c.json(
      {
        success: false,
        code: "INVALID_CREDENTIALS",
        message: "Invalid or expired access token",
        type: "domain",
      },
      401
    )
  }

  const active = await findActiveSessionWithUser(db, payload.sid)
  if (!active || active.user.id !== payload.sub) {
    return c.json(
      {
        success: false,
        code: "INVALID_CREDENTIALS",
        message: "Session is inactive or revoked",
        type: "domain",
      },
      401
    )
  }

  c.set("user", active.user)
  c.set("session", active.session)

  await next()
})
