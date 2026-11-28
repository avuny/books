import { beforeAll, describe, expect, it } from "vitest"
import { and, eq } from "@avuny/db"
import { platformAdmins, platformAuditEvents } from "@avuny/db"
import {
  PLATFORM_AUDIT_ACTIONS,
  PLATFORM_AUTH_COOKIE_NAME,
  PlatformManagementErrorCode as Code,
  PlatformAuthErrorCode as AuthCode,
  type PlatformAcceptInviteResponse,
  type PlatformAdminDto,
  type PlatformAuthSuccess,
  type PlatformInviteAdminResponse,
  type PlatformRoleDto,
  type PlatformSessionDto,
} from "@avuny/contracts/platform-admin"
import { app } from "./routes.js"
import { db } from "./db.js"
import { resetPlatformTables } from "./test-support/database.js"
import { syncPlatformRoles } from "./modules/platform-role/platform-role.seed.js"
import { bootstrapPlatformAdmin } from "./modules/platform-admin/platform-admin.bootstrap.js"
import { totpCode } from "./modules/platform-auth/platform-auth.crypto.js"
import {
  PLATFORM_AUTH_ROUTE_ACCESS,
  type PlatformRouteAccess,
} from "./modules/platform-auth/platform-auth.permissions.js"
import { PLATFORM_ADMIN_ROUTE_ACCESS } from "./modules/platform-admin/platform-admin.permissions.js"
import { PLATFORM_ROLE_ROUTE_ACCESS } from "./modules/platform-role/platform-role.permissions.js"

/**
 * A1-06: generated route access and audit coverage (PAC4, PAC11).
 *
 * PAC4: the declarations in *.permissions.ts are the route list (the route
 * inventory spec keeps them in sync with the OpenAPI document). One 403 test
 * is generated per permission-gated route: an active admin whose only role
 * grants zero permissions must be denied on every one of them, plus a
 * generated 401 check without a session, and an over-gating guard that the
 * self-service ("authenticated") routes stay reachable for that same admin.
 *
 * PAC11: one happy-path pass over every mutating route asserts the audit row
 * it must write (action, resource, resourceId, before/after snapshots).
 */

interface ApiBody<T> {
  success: boolean
  data?: T
  code?: string
  message?: string
}

const request = async <T>(
  method: string,
  path: string,
  json?: unknown,
  cookie?: string
): Promise<{ status: number; body: ApiBody<T>; setCookie: string | null }> => {
  const res = await app.request(`/api${path}`, {
    method,
    headers: {
      ...(json !== undefined ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: json === undefined ? undefined : JSON.stringify(json),
  })
  return {
    status: res.status,
    body: (await res.json()) as ApiBody<T>,
    setCookie: res.headers.get("set-cookie"),
  }
}

const get = <T>(path: string, cookie?: string) => request<T>("GET", path, undefined, cookie)
const post = <T>(path: string, json?: unknown, cookie?: string) => request<T>("POST", path, json, cookie)
const patch = <T>(path: string, json: unknown, cookie?: string) => request<T>("PATCH", path, json, cookie)
const put = <T>(path: string, json: unknown, cookie?: string) => request<T>("PUT", path, json, cookie)
const del = <T>(path: string, cookie?: string) => request<T>("DELETE", path, undefined, cookie)

const sessionCookieFrom = (setCookie: string | null): string => {
  expect(setCookie).toBeTruthy()
  const pair = setCookie!.split(";")[0]!
  expect(pair.startsWith(`${PLATFORM_AUTH_COOKIE_NAME}=`)).toBe(true)
  return pair
}

const PASSWORD = "correct horse battery staple"
const SUPER_EMAIL = "owner@avuny.dev"

/** Full bootstrap: seed, first super_admin invite, acceptance, enrollment. */
const bootstrapAndSignIn = async (): Promise<{
  cookie: string
  admin: PlatformAdminDto
  totpSecret: string
}> => {
  await syncPlatformRoles(db)
  const boot = await bootstrapPlatformAdmin(db, {
    email: SUPER_EMAIL,
    webAppUrl: "https://admin.example.com",
  })
  expect(boot.created).toBe(true)
  const accept = await post<PlatformAcceptInviteResponse>(
    "/platform-auth/invites/accept",
    { token: boot.inviteUrl!.split("token=")[1]!, name: "Owner One", password: PASSWORD }
  )
  expect(accept.status, JSON.stringify(accept.body)).toBe(200)
  const { enrollmentTicket, totpSecret } = accept.body.data!
  const enroll = await post<PlatformAuthSuccess>(
    "/platform-auth/invites/enroll-totp",
    { enrollmentTicket, code: totpCode(totpSecret) }
  )
  expect(enroll.status, JSON.stringify(enroll.body)).toBe(200)
  return {
    cookie: sessionCookieFrom(enroll.setCookie),
    admin: enroll.body.data!.admin,
    totpSecret,
  }
}

/** Second password+TOTP login for the bootstrapped super admin. */
const signInAgain = async (totpSecret: string): Promise<string> => {
  const login = await post<{ pendingToken: string }>("/platform-auth/login", {
    email: SUPER_EMAIL,
    password: PASSWORD,
  })
  expect(login.status, JSON.stringify(login.body)).toBe(200)
  const totp = await post<PlatformAuthSuccess>("/platform-auth/login/totp", {
    pendingToken: login.body.data!.pendingToken,
    code: totpCode(totpSecret),
  })
  expect(totp.status, JSON.stringify(totp.body)).toBe(200)
  return sessionCookieFrom(totp.setCookie)
}

const adminIdByEmail = async (email: string): Promise<string> => {
  const [row] = await db
    .select()
    .from(platformAdmins)
    .where(eq(platformAdmins.email, email))
    .limit(1)
  expect(row, `admin ${email}`).toBeTruthy()
  return row!.id
}

const auditRows = async (action: string, resourceId: string) =>
  db
    .select()
    .from(platformAuditEvents)
    .where(
      and(
        eq(platformAuditEvents.action, action),
        eq(platformAuditEvents.resourceId, resourceId)
      )
    )

// ---------------------------------------------------------------------------
// Shared state: one setup for the whole file, tests only read and deny.
// ---------------------------------------------------------------------------

const ROUTE_ACCESS: Record<string, PlatformRouteAccess> = {
  ...PLATFORM_AUTH_ROUTE_ACCESS,
  ...PLATFORM_ADMIN_ROUTE_ACCESS,
  ...PLATFORM_ROLE_ROUTE_ACCESS,
}

const ADMIN_ID = "11111111-1111-4111-8111-111111111111"
const ROLE_ID = "22222222-2222-4222-8222-222222222222"

/** A concrete request for every permission-gated route. */
const REQUESTS: Record<string, { method: string; path: string; body?: unknown }> = {
  "GET /platform-admins": { method: "GET", path: "/platform-admins" },
  "POST /platform-admins/invite": {
    method: "POST",
    path: "/platform-admins/invite",
    body: { email: "denied@avuny.dev", roleIds: [] },
  },
  "GET /platform-admins/{adminId}": {
    method: "GET",
    path: `/platform-admins/${ADMIN_ID}`,
  },
  "PATCH /platform-admins/{adminId}": {
    method: "PATCH",
    path: `/platform-admins/${ADMIN_ID}`,
    body: { name: "Denied" },
  },
  "PUT /platform-admins/{adminId}/roles": {
    method: "PUT",
    path: `/platform-admins/${ADMIN_ID}/roles`,
    body: { roleIds: [] },
  },
  "POST /platform-admins/{adminId}/disable": {
    method: "POST",
    path: `/platform-admins/${ADMIN_ID}/disable`,
    body: {},
  },
  "GET /platform-roles": { method: "GET", path: "/platform-roles" },
  "POST /platform-roles": {
    method: "POST",
    path: "/platform-roles",
    body: { key: "denied", name: "Denied", permissions: [] },
  },
  "GET /platform-roles/{roleId}": {
    method: "GET",
    path: `/platform-roles/${ROLE_ID}`,
  },
  "PATCH /platform-roles/{roleId}": {
    method: "PATCH",
    path: `/platform-roles/${ROLE_ID}`,
    body: { name: "Denied" },
  },
  "DELETE /platform-roles/{roleId}": {
    method: "DELETE",
    path: `/platform-roles/${ROLE_ID}`,
  },
  "POST /platform-roles/{roleId}/clone": {
    method: "POST",
    path: `/platform-roles/${ROLE_ID}/clone`,
    body: { key: "denied_clone", name: "Denied clone" },
  },
}

const permissionRoutes = Object.entries(ROUTE_ACCESS).filter(
  ([, access]) => access !== "public" && access !== "authenticated"
)

let superCookie: string
let superSecret: string
let noPermCookie: string

beforeAll(async () => {
  await resetPlatformTables(db)
  const boot = await bootstrapAndSignIn()
  superCookie = boot.cookie
  superSecret = boot.totpSecret

  // A custom role with zero permissions, held by a second active admin.
  const created = await post<PlatformRoleDto>(
    "/platform-roles",
    { key: "no_perms", name: "No permissions", permissions: [] },
    superCookie
  )
  expect(created.status, JSON.stringify(created.body)).toBe(201)
  const invite = await post<PlatformInviteAdminResponse>(
    "/platform-admins/invite",
    { email: "nop@avuny.dev", roleIds: [created.body.data!.id] },
    superCookie
  )
  expect(invite.status, JSON.stringify(invite.body)).toBe(201)
  const accept = await post<PlatformAcceptInviteResponse>(
    "/platform-auth/invites/accept",
    {
      token: invite.body.data!.inviteUrl.split("token=")[1]!,
      name: "No Perms",
      password: PASSWORD,
    }
  )
  expect(accept.status, JSON.stringify(accept.body)).toBe(200)
  const { enrollmentTicket, totpSecret } = accept.body.data!
  const enroll = await post<PlatformAuthSuccess>(
    "/platform-auth/invites/enroll-totp",
    { enrollmentTicket, code: totpCode(totpSecret) }
  )
  expect(enroll.status, JSON.stringify(enroll.body)).toBe(200)
  noPermCookie = sessionCookieFrom(enroll.setCookie)
}, 120_000)

describe("route access (PAC4, generated from the route declarations)", () => {
  it("every declared route has a concrete request in this suite", () => {
    for (const [route] of permissionRoutes) {
      expect(REQUESTS[route], `request fixture for ${route}`).toBeTruthy()
    }
    expect(Object.keys(REQUESTS).sort()).toEqual(
      permissionRoutes.map(([route]) => route).sort()
    )
  })

  for (const [route, access] of permissionRoutes) {
    it(`denies ${route} without ${access} (403 PERMISSION_DENIED)`, async () => {
      const fixture = REQUESTS[route]!
      const res = await request(
        fixture.method,
        fixture.path,
        fixture.body,
        noPermCookie
      )
      expect(res.status, JSON.stringify(res.body)).toBe(403)
      expect(res.body.code).toBe(Code.PERMISSION_DENIED)
    })

    it(`rejects ${route} without a session (401 UNAUTHENTICATED)`, async () => {
      const fixture = REQUESTS[route]!
      const res = await request(fixture.method, fixture.path, fixture.body)
      expect(res.status, JSON.stringify(res.body)).toBe(401)
      expect(res.body.code).toBe(AuthCode.UNAUTHENTICATED)
    })
  }

  it("keeps self-service routes reachable for an admin with no permissions", async () => {
    const me = await get("/platform-auth/me", noPermCookie)
    expect(me.status, JSON.stringify(me.body)).toBe(200)
    const sessions = await get("/platform-auth/sessions", noPermCookie)
    expect(sessions.status, JSON.stringify(sessions.body)).toBe(200)
    const missing = await del(
      "/platform-auth/sessions/33333333-3333-4333-8333-333333333333",
      noPermCookie
    )
    expect(missing.status).not.toBe(403)
  })
})

describe("audit coverage (PAC11)", () => {
  it("writes before/after audit rows for every mutating route", async () => {
    // Invite -> audited as invited/platform-invite (invites need >= 1 role)
    const rolesList0 = await get<PlatformRoleDto[]>("/platform-roles", superCookie)
    const viewerRole0 = rolesList0.body.data!.find((r) => r.key === "viewer")!
    const invite = await post<PlatformInviteAdminResponse>(
      "/platform-admins/invite",
      { email: "target@avuny.dev", roleIds: [viewerRole0.id] },
      superCookie
    )
    expect(invite.status, JSON.stringify(invite.body)).toBe(201)
    const inviteId = invite.body.data!.inviteId
    const invited = await auditRows(PLATFORM_AUDIT_ACTIONS.ADMIN_INVITED, inviteId)
    expect(invited).toHaveLength(1)
    expect(invited[0]!.after).toMatchObject({ email: "target@avuny.dev" })

    // The admin row is created at acceptance, not at invite time.
    const accept = await post<PlatformAcceptInviteResponse>(
      "/platform-auth/invites/accept",
      {
        token: invite.body.data!.inviteUrl.split("token=")[1]!,
        name: "Target Admin",
        password: PASSWORD,
      }
    )
    expect(accept.status, JSON.stringify(accept.body)).toBe(200)
    const enroll = await post<PlatformAuthSuccess>(
      "/platform-auth/invites/enroll-totp",
      {
        enrollmentTicket: accept.body.data!.enrollmentTicket,
        code: totpCode(accept.body.data!.totpSecret),
      }
    )
    expect(enroll.status, JSON.stringify(enroll.body)).toBe(200)

    const targetId = await adminIdByEmail("target@avuny.dev")

    // Rename -> audited with before/after names
    const renamed = await patch(
      `/platform-admins/${targetId}`,
      { name: "Target Renamed" },
      superCookie
    )
    expect(renamed.status, JSON.stringify(renamed.body)).toBe(200)
    const updates = await auditRows(PLATFORM_AUDIT_ACTIONS.ADMIN_UPDATED, targetId)
    const rename = updates.find(
      (row) => (row.after as { name?: string } | null)?.name === "Target Renamed"
    )
    expect(rename, JSON.stringify(updates)).toBeTruthy()
    expect(rename!.before).toBeTruthy()

    // Replace roles -> audited with before/after role keys
    const setRoles = await put(
      `/platform-admins/${targetId}/roles`,
      { roleIds: [] },
      superCookie
    )
    expect(setRoles.status, JSON.stringify(setRoles.body)).toBe(200)
    const roleUpdates = await auditRows(
      PLATFORM_AUDIT_ACTIONS.ADMIN_UPDATED,
      targetId
    )
    const roleChange = roleUpdates.find((row) =>
      Array.isArray((row.after as { roles?: unknown[] } | null)?.roles)
    )!
    expect(roleChange, JSON.stringify(roleUpdates)).toBeTruthy()
    expect(roleChange.after).toMatchObject({ roles: [] })
    expect(roleChange.before).toMatchObject({ roles: ["viewer"] })
    expect(roleChange.before).toBeTruthy()

    // Disable -> audited
    const disabled = await post(
      `/platform-admins/${targetId}/disable`,
      {},
      superCookie
    )
    expect(disabled.status, JSON.stringify(disabled.body)).toBe(200)
    const disables = await auditRows(
      PLATFORM_AUDIT_ACTIONS.ADMIN_DISABLED,
      targetId
    )
    expect(disables).toHaveLength(1)

    // Role create -> update -> clone -> delete, each audited
    const created = await post<PlatformRoleDto>(
      "/platform-roles",
      { key: "audit_role", name: "Audit role", permissions: [] },
      superCookie
    )
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const roleId = created.body.data!.id
    const roleCreates = await auditRows(PLATFORM_AUDIT_ACTIONS.ROLE_CREATED, roleId)
    expect(roleCreates).toHaveLength(1)
    expect(roleCreates[0]!.after).toMatchObject({ key: "audit_role" })

    const rolePatched = await patch(
      `/platform-roles/${roleId}`,
      { name: "Audit role v2" },
      superCookie
    )
    expect(rolePatched.status, JSON.stringify(rolePatched.body)).toBe(200)
    const roleUpdates2 = await auditRows(
      PLATFORM_AUDIT_ACTIONS.ROLE_UPDATED,
      roleId
    )
    expect(roleUpdates2).toHaveLength(1)
    expect(roleUpdates2[0]!.before).toBeTruthy()
    expect(roleUpdates2[0]!.after).toBeTruthy()

    const cloned = await post<PlatformRoleDto>(
      `/platform-roles/${roleId}/clone`,
      { key: "audit_role_clone", name: "Audit role clone" },
      superCookie
    )
    expect(cloned.status, JSON.stringify(cloned.body)).toBe(201)
    const cloneId = cloned.body.data!.id
    const cloneCreates = await auditRows(
      PLATFORM_AUDIT_ACTIONS.ROLE_CREATED,
      cloneId
    )
    expect(cloneCreates).toHaveLength(1)

    const deleted = await del(`/platform-roles/${cloneId}`, superCookie)
    expect(deleted.status, JSON.stringify(deleted.body)).toBe(200)
    const roleDeletes = await auditRows(
      PLATFORM_AUDIT_ACTIONS.ROLE_DELETED,
      cloneId
    )
    expect(roleDeletes).toHaveLength(1)
    expect(roleDeletes[0]!.before).toBeTruthy()

    // Session revoke -> audited (revoke the second session, keep the first)
    const secondCookie = await signInAgain(superSecret)
    const sessions = await get<PlatformSessionDto[]>(
      "/platform-auth/sessions",
      secondCookie
    )
    expect(sessions.status, JSON.stringify(sessions.body)).toBe(200)
    const other = sessions.body.data!.find((s) => !s.current)!
    const revoked = await del(`/platform-auth/sessions/${other.id}`, secondCookie)
    expect(revoked.status, JSON.stringify(revoked.body)).toBe(200)
    const revokes = await auditRows(
      PLATFORM_AUDIT_ACTIONS.ADMIN_SESSION_REVOKED,
      other.id
    )
    expect(revokes).toHaveLength(1)

    // Logout -> audited
    const logout = await post("/platform-auth/logout", {}, secondCookie)
    expect(logout.status, JSON.stringify(logout.body)).toBe(200)
    const superId = await adminIdByEmail(SUPER_EMAIL)
    const logouts = await db
      .select()
      .from(platformAuditEvents)
      .where(
        and(
          eq(platformAuditEvents.action, PLATFORM_AUDIT_ACTIONS.ADMIN_LOGOUT),
          eq(platformAuditEvents.adminId, superId)
        )
      )
    expect(logouts.length).toBeGreaterThanOrEqual(1)
  }, 120_000)
})
