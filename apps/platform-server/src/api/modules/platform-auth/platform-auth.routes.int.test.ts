import { beforeEach, describe, expect, it } from "vitest"
import { eq } from "@avuny/db"
import {
  platformAdminRoles,
  platformAdminSessions,
  platformAdmins,
  platformAuditEvents,
  platformInvites,
  platformRoles,
} from "@avuny/db"
import {
  PLATFORM_AUDIT_ACTIONS,
  PLATFORM_AUTH_COOKIE_NAME,
  PlatformAuthErrorCode as Code,
  type PlatformAcceptInviteResponse,
  type PlatformAdminDto,
  type PlatformAuthSuccess,
  type PlatformLoginResponse,
  type PlatformSessionDto,
} from "@avuny/contracts/platform-admin"
import { app } from "../../routes.js"
import { db } from "../../db.js"
import { resetPlatformTables } from "../../test-support/database.js"
import { syncPlatformRoles } from "../platform-role/platform-role.seed.js"
import { bootstrapPlatformAdmin } from "../platform-admin/platform-admin.bootstrap.js"
import { totpCode } from "./platform-auth.crypto.js"

/**
 * A1-04 route integration tests: the full admin identity lifecycle over HTTP
 * against the real app and the real test database (PAC1, PAC2).
 */

interface ApiBody<T> {
  success: boolean
  data?: T
  code?: string
  message?: string
}

const post = async <T>(
  path: string,
  json: unknown,
  cookie?: string
): Promise<{ status: number; body: ApiBody<T>; setCookie: string | null }> => {
  const res = await app.request(`/api${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(json),
  })
  return {
    status: res.status,
    body: (await res.json()) as ApiBody<T>,
    setCookie: res.headers.get("set-cookie"),
  }
}

const get = async <T>(path: string, cookie?: string) => {
  const res = await app.request(`/api${path}`, {
    headers: cookie ? { cookie } : {},
  })
  return {
    status: res.status,
    body: (await res.json()) as ApiBody<T>,
  }
}

const del = async <T>(path: string, cookie?: string) => {
  const res = await app.request(`/api${path}`, {
    method: "DELETE",
    headers: cookie ? { cookie } : {},
  })
  return {
    status: res.status,
    body: (await res.json()) as ApiBody<T>,
  }
}

const sessionCookieFrom = (setCookie: string | null): string => {
  expect(setCookie).toBeTruthy()
  const pair = setCookie!.split(";")[0]!
  expect(pair.startsWith(`${PLATFORM_AUTH_COOKIE_NAME}=`)).toBe(true)
  return pair
}

const PASSWORD = "correct horse battery staple"

/** Seeds roles, bootstraps a super_admin invite and returns its raw token. */
const createInviteToken = async (email = "owner@avuny.dev"): Promise<string> => {
  await syncPlatformRoles(db)
  const result = await bootstrapPlatformAdmin(db, {
    email,
    webAppUrl: "https://admin.example.com",
  })
  expect(result.created).toBe(true)
  return result.inviteUrl!.split("token=")[1]!
}

/** Full invite acceptance + enrollment; returns the session cookie and admin. */
const acceptEnrollAndSignIn = async (
  token: string,
  name = "Owner One"
): Promise<{ cookie: string; admin: PlatformAdminDto; secret: string }> => {
  const accept = await post<PlatformAcceptInviteResponse>(
    "/platform-auth/invites/accept",
    { token, name, password: PASSWORD }
  )
  expect(accept.status).toBe(200)
  const { enrollmentTicket, totpSecret } = accept.body.data!
  expect(totpSecret).toMatch(/^[A-Z2-7]+$/)
  expect(accept.body.data!.otpauthUrl).toContain("otpauth://totp/")

  const enroll = await post<PlatformAuthSuccess>(
    "/platform-auth/invites/enroll-totp",
    { enrollmentTicket, code: totpCode(totpSecret) }
  )
  expect(enroll.status, JSON.stringify(enroll.body)).toBe(200)
  return {
    cookie: sessionCookieFrom(enroll.setCookie),
    admin: enroll.body.data!.admin,
    secret: totpSecret,
  }
}

beforeEach(async () => {
  await resetPlatformTables(db)
})

describe("invite acceptance and enrollment (A1-04)", () => {
  it("runs the full join flow and lands in the app (spec 3.2)", async () => {
    const token = await createInviteToken()
    const { cookie, admin } = await acceptEnrollAndSignIn(token)

    // Admin is active, holds exactly the super_admin role, invite consumed.
    expect(admin.status).toBe("active")
    expect(admin.roles).toEqual(["super_admin"])
    expect(admin.totpEnabledAt).not.toBeNull()

    const [invite] = await db.select().from(platformInvites)
    expect(invite!.acceptedAt).not.toBeNull()

    const grantRows = await db.select().from(platformAdminRoles)
    expect(grantRows).toHaveLength(1)

    // The invite acceptance and the first login are audited (PA-R6).
    const audits = await db
      .select()
      .from(platformAuditEvents)
      .where(eq(platformAuditEvents.adminId, admin.id))
    const actions = audits.map((row) => row.action)
    expect(actions).toContain(PLATFORM_AUDIT_ACTIONS.ADMIN_INVITE_ACCEPTED)
    expect(actions).toContain(PLATFORM_AUDIT_ACTIONS.ADMIN_LOGIN)

    // The session cookie authenticates (and /me never leaks secrets, PA-R11).
    const me = await get<PlatformAdminDto>("/platform-auth/me", cookie)
    expect(me.status).toBe(200)
    expect(me.body.data!.email).toBe("owner@avuny.dev")
    expect(JSON.stringify(me.body)).not.toMatch(/password|secret|hash/i)
  })

  it("rejects unknown, reused and expired invites with one generic 410", async () => {
    const token = await createInviteToken()

    const unknown = await post("/platform-auth/invites/accept", {
      token: "0".repeat(64),
      name: "Nope",
      password: PASSWORD,
    })
    expect(unknown.status).toBe(410)
    expect(unknown.body.code).toBe(Code.INVALID_INVITE)

    await acceptEnrollAndSignIn(token)
    const reused = await post("/platform-auth/invites/accept", {
      token,
      name: "Again",
      password: PASSWORD,
    })
    expect(reused.status).toBe(410)
    expect(reused.body.code).toBe(Code.INVALID_INVITE)
    expect(reused.body.message).toBe(unknown.body.message)

    const second = await bootstrapPlatformAdmin(db, {
      email: "two@avuny.dev",
      webAppUrl: "https://admin.example.com",
    })
    expect(second.created).toBe(false) // an admin exists: bootstrap is a no-op

    // Expired invite: straight row, then accept fails the same way.
    const expired = await createSecondInviteToken()
    await db
      .update(platformInvites)
      .set({
        createdAt: new Date(Date.now() - 2 * 3_600_000),
        expiresAt: new Date(Date.now() - 3_600_000),
      })
      .where(eq(platformInvites.tokenHash, expired.hash))
    const gone = await post("/platform-auth/invites/accept", {
      token: expired.token,
      name: "Late",
      password: PASSWORD,
    })
    expect(gone.status).toBe(410)
  })

  it("rejects a wrong enrollment code and a tampered ticket", async () => {
    const token = await createInviteToken()
    const accept = await post<PlatformAcceptInviteResponse>(
      "/platform-auth/invites/accept",
      { token, name: "Owner", password: PASSWORD }
    )
    const { enrollmentTicket, totpSecret } = accept.body.data!

    const wrongCode = totpCode(totpSecret) === "000000" ? "000001" : "000000"
    const bad = await post("/platform-auth/invites/enroll-totp", {
      enrollmentTicket,
      code: wrongCode,
    })
    expect(bad.status, JSON.stringify(bad.body)).toBe(401)
    expect(bad.body.code).toBe(Code.INVALID_CREDENTIALS)

    // The admin is still invited: no session possible before enrollment.
    const [admin] = await db.select().from(platformAdmins)
    expect(admin!.status).toBe("invited")
    const loginAttempt = await post("/platform-auth/login", {
      email: "owner@avuny.dev",
      password: PASSWORD,
    })
    expect(loginAttempt.status, JSON.stringify(loginAttempt.body)).toBe(401)

    const tampered = await post("/platform-auth/invites/enroll-totp", {
      enrollmentTicket: enrollmentTicket.replace(/.$/, "A"),
      code: totpCode(totpSecret),
    })
    expect(tampered.status).toBe(401)
    expect(tampered.body.code).toBe(Code.INVALID_TICKET)

    // The right code still completes enrollment after the failed attempts.
    const good = await post<PlatformAuthSuccess>(
      "/platform-auth/invites/enroll-totp",
      { enrollmentTicket, code: totpCode(totpSecret) }
    )
    expect(good.status).toBe(200)
  })
})

/** Creates a second invite directly (admin-inviting-admin routes are A1-05). */
const createSecondInviteToken = async () => {
  const [role] = await db
    .select()
    .from(platformRoles)
    .where(eq(platformRoles.key, "viewer"))
  const token = "f".repeat(64)
  const { hashPlatformToken } = await import(
    "../platform-admin/platform-admin.bootstrap.js"
  )
  await db.insert(platformInvites).values({
    email: "two@avuny.dev",
    roleIds: [role!.id],
    tokenHash: hashPlatformToken(token),
    expiresAt: new Date(Date.now() + 3_600_000),
  })
  return { token, hash: hashPlatformToken(token) }
}

describe("login (A1-04, PAC2)", () => {
  it("signs in with password + TOTP and rejects everything else identically", async () => {
    const token = await createInviteToken()
    const { secret } = await acceptEnrollAndSignIn(token)

    // Step 1 happy path.
    const step1 = await post<PlatformLoginResponse>("/platform-auth/login", {
      email: " Owner@Avuny.dev ",
      password: PASSWORD,
    })
    expect(step1.status).toBe(200)
    const { pendingToken } = step1.body.data!
    expect(step1.setCookie).toBeNull() // no session before TOTP

    // Step 2 with a wrong code: same generic error as a wrong password.
    const rightCode = totpCode(secret)
    const wrongTotp = await post("/platform-auth/login/totp", {
      pendingToken,
      code: rightCode === "999999" ? "999998" : "999999",
    })
    expect(wrongTotp.status).toBe(401)
    expect(wrongTotp.body.code).toBe(Code.INVALID_CREDENTIALS)

    // Step 2 with the right code: session cookie issued.
    const step2 = await post<PlatformAuthSuccess>("/platform-auth/login/totp", {
      pendingToken,
      code: totpCode(secret),
    })
    expect(step2.status).toBe(200)
    const cookie = sessionCookieFrom(step2.setCookie)
    const me = await get<PlatformAdminDto>("/platform-auth/me", cookie)
    expect(me.status).toBe(200)
    expect(me.body.data!.lastLoginAt).not.toBeNull()
  })

  it("answers unknown email, wrong password and disabled accounts identically", async () => {
    const token = await createInviteToken()
    await acceptEnrollAndSignIn(token)

    const unknownEmail = await post("/platform-auth/login", {
      email: "ghost@avuny.dev",
      password: PASSWORD,
    })
    const wrongPassword = await post("/platform-auth/login", {
      email: "owner@avuny.dev",
      password: "wrong password",
    })
    expect(unknownEmail.status).toBe(401)
    expect(wrongPassword.status).toBe(401)
    expect(unknownEmail.body.code).toBe(Code.INVALID_CREDENTIALS)
    expect(wrongPassword.body).toEqual(unknownEmail.body) // byte-identical: no enumeration

    // Disabled account: same answer (audit keeps the real reason).
    await db
      .update(platformAdmins)
      .set({ status: "disabled" })
      .where(eq(platformAdmins.email, "owner@avuny.dev"))
    const disabled = await post("/platform-auth/login", {
      email: "owner@avuny.dev",
      password: PASSWORD,
    })
    expect(disabled.status).toBe(401)
    expect(disabled.body).toEqual(unknownEmail.body)

    const failures = await db
      .select()
      .from(platformAuditEvents)
      .where(eq(platformAuditEvents.action, PLATFORM_AUDIT_ACTIONS.ADMIN_LOGIN_FAILED))
    const reasons = failures.map((row) => (row.after as { reason: string }).reason)
    expect(reasons).toEqual(
      expect.arrayContaining(["unknown_email", "bad_password", "disabled"])
    )
  })

  it("locks after 5 failed attempts for 15 minutes and audits every attempt", async () => {
    const token = await createInviteToken()
    const { secret } = await acceptEnrollAndSignIn(token)

    for (let i = 0; i < 5; i++) {
      const attempt = await post("/platform-auth/login", {
        email: "owner@avuny.dev",
        password: "wrong password",
      })
      expect(attempt.status).toBe(401)
    }

    const [admin] = await db.select().from(platformAdmins)
    expect(admin!.failedAttempts).toBe(5)
    expect(admin!.lockedUntil).not.toBeNull()
    const lockMinutes =
      (admin!.lockedUntil!.getTime() - Date.now()) / 60_000
    expect(lockMinutes).toBeGreaterThan(14)
    expect(lockMinutes).toBeLessThanOrEqual(15)

    // Even the right password is refused while locked, with the generic error.
    const locked = await post("/platform-auth/login", {
      email: "owner@avuny.dev",
      password: PASSWORD,
    })
    expect(locked.status).toBe(401)
    expect(locked.body.code).toBe(Code.INVALID_CREDENTIALS)

    // Unlock by expiry, then a full login resets the counter.
    await db
      .update(platformAdmins)
      .set({ lockedUntil: new Date(Date.now() - 1000) })
      .where(eq(platformAdmins.id, admin!.id))
    const step1 = await post<PlatformLoginResponse>("/platform-auth/login", {
      email: "owner@avuny.dev",
      password: PASSWORD,
    })
    expect(step1.status).toBe(200)
    const step2 = await post("/platform-auth/login/totp", {
      pendingToken: step1.body.data!.pendingToken,
      code: totpCode(secret),
    })
    expect(step2.status).toBe(200)
    const [after] = await db.select().from(platformAdmins)
    expect(after!.failedAttempts).toBe(0)
    expect(after!.lockedUntil).toBeNull()
  })
})

describe("sessions (A1-04, PAC2)", () => {
  it("a tenant token or garbage cookie never authenticates (PAC2)", async () => {
    const token = await createInviteToken()
    await acceptEnrollAndSignIn(token)

    for (const bogus of [
      `${PLATFORM_AUTH_COOKIE_NAME}=not-a-real-token`,
      `${PLATFORM_AUTH_COOKIE_NAME}=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEiLCJzaWQiOiJzZXNzaW9uLTEifQ.fake`,
      `refresh_token=whatever`,
    ]) {
      const res = await get("/platform-auth/me", bogus)
      expect(res.status).toBe(401)
      expect(res.body.code).toBe(Code.UNAUTHENTICATED)
    }
  })

  it("lists and revokes own sessions; a revoked session dies immediately", async () => {
    const token = await createInviteToken()
    const { cookie, secret } = await acceptEnrollAndSignIn(token)

    // Second session via login.
    const step1 = await post<PlatformLoginResponse>("/platform-auth/login", {
      email: "owner@avuny.dev",
      password: PASSWORD,
    })
    const step2 = await post("/platform-auth/login/totp", {
      pendingToken: step1.body.data!.pendingToken,
      code: totpCode(secret),
    })
    const cookie2 = sessionCookieFrom(step2.setCookie)

    const sessions = await get<PlatformSessionDto[]>("/platform-auth/sessions", cookie)
    expect(sessions.status).toBe(200)
    expect(sessions.body.data!).toHaveLength(2)
    expect(sessions.body.data!.some((s) => s.current)).toBe(true)
    const other = sessions.body.data!.find((s) => !s.current)!

    // Cannot revoke with someone else's id shape; can revoke the other session.
    const missing = await del(
      `/platform-auth/sessions/00000000-0000-0000-0000-000000000000`,
      cookie
    )
    expect(missing.status).toBe(404)

    const revoked = await del(`/platform-auth/sessions/${other.id}`, cookie)
    expect(revoked.status).toBe(200)
    const after = await get("/platform-auth/me", cookie2)
    expect(after.status).toBe(401)

    // The current session (kept) still works.
    const still = await get("/platform-auth/me", cookie)
    expect(still.status).toBe(200)
  })

  it("enforces idle expiry, the 7-day absolute cap and revocation", async () => {
    const token = await createInviteToken()
    const { cookie } = await acceptEnrollAndSignIn(token)

    // Idle expiry: expires_at in the past kills the session.
    const [session] = await db.select().from(platformAdminSessions)
    await db
      .update(platformAdminSessions)
      .set({
        createdAt: new Date(Date.now() - 2 * 3_600_000),
        expiresAt: new Date(Date.now() - 3_600_000),
      })
      .where(eq(platformAdminSessions.id, session!.id))
    expect((await get("/platform-auth/me", cookie)).status).toBe(401)

    // Absolute cap: created 8 days ago dies even with fresh idle expiry.
    await db
      .update(platformAdminSessions)
      .set({
        createdAt: new Date(Date.now() - 8 * 24 * 3_600_000),
        expiresAt: new Date(Date.now() + 3_600_000),
      })
      .where(eq(platformAdminSessions.id, session!.id))
    expect((await get("/platform-auth/me", cookie)).status).toBe(401)
  })

  it("logout revokes the session and clears the cookie", async () => {
    const token = await createInviteToken()
    const { cookie } = await acceptEnrollAndSignIn(token)

    const out = await post("/platform-auth/logout", {}, cookie)
    expect(out.status).toBe(200)
    expect(out.setCookie).toContain(`${PLATFORM_AUTH_COOKIE_NAME}=;`)

    expect((await get("/platform-auth/me", cookie)).status).toBe(401)

    const [session] = await db.select().from(platformAdminSessions)
    expect(session!.revokedAt).not.toBeNull()
    const audits = await db
      .select()
      .from(platformAuditEvents)
      .where(eq(platformAuditEvents.action, PLATFORM_AUDIT_ACTIONS.ADMIN_LOGOUT))
    expect(audits).toHaveLength(1)
  })
})
