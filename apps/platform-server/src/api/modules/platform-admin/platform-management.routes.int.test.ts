import { beforeEach, describe, expect, it } from "vitest"
import { and, eq } from "@avuny/db"
import {
  platformAdminRoles,
  platformAdmins,
  platformAuditEvents,
  platformRoles,
} from "@avuny/db"
import {
  PLATFORM_AUDIT_ACTIONS,
  PLATFORM_AUTH_COOKIE_NAME,
  PlatformAuthErrorCode as AuthCode,
  PlatformManagementErrorCode as Code,
  type PlatformAdminDto,
  type PlatformAdminListResponse,
  type PlatformAuthSuccess,
  type PlatformAcceptInviteResponse,
  type PlatformInviteAdminResponse,
  type PlatformRoleDto,
} from "@avuny/contracts/platform-admin"
import { app } from "../../routes.js"
import { db } from "../../db.js"
import { resetPlatformTables } from "../../test-support/database.js"
import { syncPlatformRoles } from "../platform-role/platform-role.seed.js"
import { bootstrapPlatformAdmin } from "./platform-admin.bootstrap.js"
import { totpCode } from "../platform-auth/platform-auth.crypto.js"

/**
 * A1-05 management route integration tests: admins and roles over HTTP against
 * the real app and the real test database. Covers PA-R2 (anti-escalation),
 * PA-R3 (last super admin, including the PAC3 concurrency case), PA-R4
 * (self-edit) and PA-R5 (built-in role lock), plus the PA-R7 permission gate.
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

const roleIdByKey = async (key: string): Promise<string> => {
  const [role] = await db
    .select()
    .from(platformRoles)
    .where(eq(platformRoles.key, key))
    .limit(1)
  expect(role, `role ${key} seeded`).toBeTruthy()
  return role!.id
}

/** Seeds roles, bootstraps the first super_admin and signs them in. */
const signInSuperAdmin = async (): Promise<{
  cookie: string
  admin: PlatformAdminDto
}> => {
  await syncPlatformRoles(db)
  const boot = await bootstrapPlatformAdmin(db, {
    email: "owner@avuny.dev",
    webAppUrl: "https://admin.example.com",
  })
  expect(boot.created).toBe(true)
  return acceptInviteAndSignIn(boot.inviteUrl!.split("token=")[1]!, "Owner One")
}

/** Full invite acceptance + TOTP enrollment; returns the session and admin. */
const acceptInviteAndSignIn = async (
  token: string,
  name: string
): Promise<{ cookie: string; admin: PlatformAdminDto }> => {
  const accept = await post<PlatformAcceptInviteResponse>(
    "/platform-auth/invites/accept",
    { token, name, password: PASSWORD }
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
  }
}

/** Invites and joins an admin holding the given built-in role keys. */
const inviteAndJoin = async (
  superCookie: string,
  email: string,
  name: string,
  roleKeys: string[]
): Promise<{ cookie: string; admin: PlatformAdminDto }> => {
  const roleIds = await Promise.all(roleKeys.map(roleIdByKey))
  const invite = await post<PlatformInviteAdminResponse>(
    "/platform-admins/invite",
    { email, roleIds },
    superCookie
  )
  expect(invite.status, JSON.stringify(invite.body)).toBe(201)
  return acceptInviteAndSignIn(invite.body.data!.inviteUrl.split("token=")[1]!, name)
}

beforeEach(async () => {
  await resetPlatformTables(db)
})

describe("admin management (A1-05)", () => {
  it("lists admins with keyset pagination and enforces the read permission", async () => {
    const { cookie } = await signInSuperAdmin()
    const second = await inviteAndJoin(cookie, "viewer@avuny.dev", "View Er", ["viewer"])

    const firstPage = await get<PlatformAdminListResponse>(
      "/platform-admins?limit=1",
      cookie
    )
    expect(firstPage.status, JSON.stringify(firstPage.body)).toBe(200)
    expect(firstPage.body.data!.admins).toHaveLength(1)
    expect(firstPage.body.data!.nextCursor).toBeTruthy()

    const secondPage = await get<PlatformAdminListResponse>(
      `/platform-admins?limit=1&cursor=${firstPage.body.data!.nextCursor}`,
      cookie
    )
    expect(secondPage.status).toBe(200)
    expect(secondPage.body.data!.admins).toHaveLength(1)
    expect(secondPage.body.data!.nextCursor).toBeNull()
    expect(secondPage.body.data!.admins[0]!.id).not.toBe(
      firstPage.body.data!.admins[0]!.id
    )

    // A filter narrows to invited/active/disabled.
    const activeOnly = await get<PlatformAdminListResponse>(
      "/platform-admins?status=active",
      cookie
    )
    expect(activeOnly.body.data!.admins).toHaveLength(2)

    // A role holding read:platform-admin may list...
    const readerRole = await post<PlatformRoleDto>("/platform-roles", {
      key: "admin_reader",
      name: "Admin reader",
      permissions: ["read:platform-admin"],
    }, cookie)
    expect(readerRole.status, JSON.stringify(readerRole.body)).toBe(201)
    const reader = await inviteAndJoin(cookie, "reader@avuny.dev", "Read Er", [
      "admin_reader",
    ])
    const asReader = await get<PlatformAdminListResponse>("/platform-admins", reader.cookie)
    expect(asReader.status).toBe(200)

    // ...but the built-in viewer deliberately excludes admin management (PA-R7).
    const denied = await get<PlatformAdminListResponse>("/platform-admins", second.cookie)
    expect(denied.status).toBe(403)
    expect(denied.body.code).toBe(Code.PERMISSION_DENIED)

    const inviteDenied = await post("/platform-admins/invite", {
      email: "nope@avuny.dev",
      roleIds: [await roleIdByKey("viewer")],
    }, reader.cookie)
    expect(inviteDenied.status).toBe(403)
    expect(inviteDenied.body.code).toBe(Code.PERMISSION_DENIED)

    const anonymous = await get<PlatformAdminListResponse>("/platform-admins")
    expect(anonymous.status).toBe(401)
    expect(anonymous.body.code).toBe(AuthCode.UNAUTHENTICATED)

    // Profile update works for a permitted caller and is audited (PA-R6).
    const renamed = await patch<PlatformAdminDto>(
      `/platform-admins/${second.admin.id}`,
      { name: "Viewer Two" },
      cookie
    )
    expect(renamed.status, JSON.stringify(renamed.body)).toBe(200)
    expect(renamed.body.data!.name).toBe("Viewer Two")
    const audits = await db
      .select()
      .from(platformAuditEvents)
      .where(eq(platformAuditEvents.resourceId, second.admin.id))
    expect(audits.map((row) => row.action)).toContain(
      PLATFORM_AUDIT_ACTIONS.ADMIN_UPDATED
    )

    const patchDenied = await patch(
      `/platform-admins/${second.admin.id}`,
      { name: "Nope" },
      reader.cookie
    )
    expect(patchDenied.status).toBe(403)
    expect(patchDenied.body.code).toBe(Code.PERMISSION_DENIED)
  })

  it("invites, refuses duplicates, and audits (spec 3.2, PA-R6)", async () => {
    const { cookie } = await signInSuperAdmin()
    const viewerRoleId = await roleIdByKey("viewer")

    const invite = await post<PlatformInviteAdminResponse>(
      "/platform-admins/invite",
      { email: "New@Avuny.dev ", roleIds: [viewerRoleId] },
      cookie
    )
    expect(invite.status, JSON.stringify(invite.body)).toBe(201)
    expect(invite.body.data!.inviteUrl).toContain("token=")
    const audits = await db
      .select()
      .from(platformAuditEvents)
      .where(eq(platformAuditEvents.resourceId, invite.body.data!.inviteId))
    expect(audits.map((row) => row.action)).toContain(
      PLATFORM_AUDIT_ACTIONS.ADMIN_INVITED
    )

    // While the invite is pending a second one is refused; after acceptance an
    // admin exists, so a third is refused differently.
    const pending = await post("/platform-admins/invite", {
      email: "new@avuny.dev",
      roleIds: [viewerRoleId],
    }, cookie)
    expect(pending.status).toBe(409)
    expect(pending.body.code).toBe(Code.INVITE_PENDING)

    await acceptInviteAndSignIn(
      invite.body.data!.inviteUrl.split("token=")[1]!,
      "New Admin"
    )
    const existing = await post("/platform-admins/invite", {
      email: "new@avuny.dev",
      roleIds: [viewerRoleId],
    }, cookie)
    expect(existing.status).toBe(409)
    expect(existing.body.code).toBe(Code.ADMIN_EXISTS)

    const unknownRole = await post("/platform-admins/invite", {
      email: "other@avuny.dev",
      roleIds: ["00000000-0000-0000-0000-000000000000"],
    }, cookie)
    expect(unknownRole.status).toBe(422)
    expect(unknownRole.body.code).toBe(Code.INVALID_ROLE_IDS)
  })

  it("replaces roles within the caller's own permissions (PA-R2) and never on self (PA-R4)", async () => {
    const { cookie, admin: superAdmin } = await signInSuperAdmin()
    const viewer = await inviteAndJoin(cookie, "viewer@avuny.dev", "View Er", ["viewer"])

    // PA-R4: not your own roles.
    const selfEdit = await put(`/platform-admins/${superAdmin.id}/roles`, {
      roleIds: [],
    }, cookie)
    expect(selfEdit.status).toBe(409)
    expect(selfEdit.body.code).toBe(Code.SELF_EDIT_DENIED)

    // A super admin grants a custom role with admin-management permissions.
    const managerRole = await post<PlatformRoleDto>("/platform-roles", {
      key: "admin_manager",
      name: "Admin manager",
      permissions: [
        "read:platform-admin",
        "update:platform-admin",
        "read:platform-role",
      ],
    }, cookie)
    expect(managerRole.status, JSON.stringify(managerRole.body)).toBe(201)

    const manager = await inviteAndJoin(cookie, "manager@avuny.dev", "Man Ager", [
      "admin_manager",
    ])

    // The manager assigns the role whose permissions they hold: fine.
    const reassigned = await put<PlatformAdminDto>(
      `/platform-admins/${viewer.admin.id}/roles`,
      { roleIds: [managerRole.body.data!.id] },
      manager.cookie
    )
    expect(reassigned.status, JSON.stringify(reassigned.body)).toBe(200)
    expect(reassigned.body.data!.roles).toEqual(["admin_manager"])

    // The built-in viewer grants reads the manager does not hold: denied.
    const viewerRoleId = await roleIdByKey("viewer")
    const grantViewer = await put(
      `/platform-admins/${viewer.admin.id}/roles`,
      { roleIds: [viewerRoleId] },
      manager.cookie
    )
    expect(grantViewer.status).toBe(403)
    expect(grantViewer.body.code).toBe(Code.ESCALATION_DENIED)

    // Granting billing_admin (permissions the manager does not hold) is PA-R2.
    const billingRoleId = await roleIdByKey("billing_admin")
    const escalation = await put(
      `/platform-admins/${viewer.admin.id}/roles`,
      { roleIds: [billingRoleId] },
      manager.cookie
    )
    expect(escalation.status).toBe(403)
    expect(escalation.body.code).toBe(Code.ESCALATION_DENIED)

    // Granting super_admin is only for super admins, full stop (PA-R2).
    const superRoleId = await roleIdByKey("super_admin")
    const grantSuper = await put(
      `/platform-admins/${viewer.admin.id}/roles`,
      { roleIds: [superRoleId] },
      manager.cookie
    )
    expect(grantSuper.status).toBe(403)
    expect(grantSuper.body.code).toBe(Code.ESCALATION_DENIED)
  })

  it("disables admins, revokes their sessions and protects the last super admin (PA-R3, PAC3)", async () => {
    const { cookie, admin: superAdmin } = await signInSuperAdmin()
    const viewer = await inviteAndJoin(cookie, "viewer@avuny.dev", "View Er", ["viewer"])

    const disabled = await post<PlatformAdminDto>(
      `/platform-admins/${viewer.admin.id}/disable`,
      undefined,
      cookie
    )
    expect(disabled.status, JSON.stringify(disabled.body)).toBe(200)
    expect(disabled.body.data!.status).toBe("disabled")

    // Their session is dead immediately.
    const me = await get("/platform-auth/me", viewer.cookie)
    expect(me.status).toBe(401)

    // PA-R4: not yourself.
    const selfDisable = await post(`/platform-admins/${superAdmin.id}/disable`, undefined, cookie)
    expect(selfDisable.status).toBe(409)
    expect(selfDisable.body.code).toBe(Code.SELF_EDIT_DENIED)

    // PAC3: two super admins, each disabling the other concurrently. The
    // guarded statements lock every active super's rows in id order, so the
    // second statement re-evaluates after the first commits: exactly one
    // succeeds, the other gets LAST_SUPER_ADMIN.
    const secondSuper = await inviteAndJoin(cookie, "second@avuny.dev", "Sec Ond", [
      "super_admin",
    ])
    const [first, second] = await Promise.all([
      post(`/platform-admins/${secondSuper.admin.id}/disable`, undefined, cookie),
      post(`/platform-admins/${superAdmin.id}/disable`, undefined, secondSuper.cookie),
    ])
    const outcomes = [
      { status: first.status, code: first.body.code },
      { status: second.status, code: second.body.code },
    ].sort((a, b) => a.status - b.status)
    expect(outcomes).toEqual([
      { status: 200, code: undefined },
      { status: 409, code: Code.LAST_SUPER_ADMIN },
    ])

    // One active super admin remains.
    const activeSupers = await db
      .select({ id: platformAdmins.id })
      .from(platformAdminRoles)
      .innerJoin(platformAdmins, eq(platformAdminRoles.adminId, platformAdmins.id))
      .where(
        and(
          eq(platformAdminRoles.roleId, await roleIdByKey("super_admin")),
          eq(platformAdmins.status, "active")
        )
      )
    expect(activeSupers).toHaveLength(1)
  })
})

describe("role management (A1-05)", () => {
  it("creates, reads, updates and deletes custom roles (PA-R1)", async () => {
    const { cookie } = await signInSuperAdmin()

    const created = await post<PlatformRoleDto>("/platform-roles", {
      key: "finance_reader",
      name: "Finance reader",
      description: "Reads billing data",
      permissions: ["read:platform-payment", "read:platform-subscription"],
    }, cookie)
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    expect(created.body.data!.permissions).toEqual([
      "read:platform-payment",
      "read:platform-subscription",
    ])
    expect(created.body.data!.isBuiltin).toBe(false)

    const duplicate = await post("/platform-roles", {
      key: "finance_reader",
      name: "Again",
      permissions: [],
    }, cookie)
    expect(duplicate.status).toBe(409)
    expect(duplicate.body.code).toBe(Code.ROLE_KEY_TAKEN)

    const invalid = await post("/platform-roles", {
      key: "bogus_role",
      name: "Bogus",
      permissions: ["delete:platform-plan"],
    }, cookie)
    expect(invalid.status).toBe(422)

    const updated = await patch<PlatformRoleDto>(
      `/platform-roles/${created.body.data!.id}`,
      { name: "Finance read-only", permissions: ["read:platform-payment"] },
      cookie
    )
    expect(updated.status, JSON.stringify(updated.body)).toBe(200)
    expect(updated.body.data!.name).toBe("Finance read-only")
    expect(updated.body.data!.permissions).toEqual(["read:platform-payment"])

    const removed = await del<null>(`/platform-roles/${created.body.data!.id}`, cookie)
    expect(removed.status).toBe(200)

    const gone = await get(`/platform-roles/${created.body.data!.id}`, cookie)
    expect(gone.status).toBe(404)
    expect(gone.body.code).toBe(Code.ROLE_NOT_FOUND)
  })

  it("locks built-in roles for edit and delete but allows cloning (PA-R5)", async () => {
    const { cookie } = await signInSuperAdmin()
    const viewerRoleId = await roleIdByKey("viewer")

    const edited = await patch(`/platform-roles/${viewerRoleId}`, {
      name: "Hacked",
    }, cookie)
    expect(edited.status).toBe(409)
    expect(edited.body.code).toBe(Code.BUILTIN_ROLE_LOCKED)

    const deleted = await del(`/platform-roles/${viewerRoleId}`, cookie)
    expect(deleted.status).toBe(409)
    expect(deleted.body.code).toBe(Code.BUILTIN_ROLE_LOCKED)

    const cloned = await post<PlatformRoleDto>(`/platform-roles/${viewerRoleId}/clone`, {
      key: "viewer_plus",
      name: "Viewer plus",
    }, cookie)
    expect(cloned.status, JSON.stringify(cloned.body)).toBe(201)
    expect(cloned.body.data!.key).toBe("viewer_plus")
    expect(cloned.body.data!.permissions.length).toBeGreaterThan(0)
    const source = await get<PlatformRoleDto>(`/platform-roles/${viewerRoleId}`, cookie)
    expect(cloned.body.data!.permissions).toEqual(source.body.data!.permissions)
  })

  it("refuses to delete a role that is still assigned (ROLE_IN_USE)", async () => {
    const { cookie } = await signInSuperAdmin()
    const viewer = await inviteAndJoin(cookie, "viewer@avuny.dev", "View Er", ["viewer"])

    // Built-in lock would win while viewer is held; use a custom role instead.
    const custom = await post<PlatformRoleDto>("/platform-roles", {
      key: "temp_role",
      name: "Temp",
      permissions: ["read:platform-dashboard"],
    }, cookie)
    expect(custom.status, JSON.stringify(custom.body)).toBe(201)
    const assigned = await put(
      `/platform-admins/${viewer.admin.id}/roles`,
      { roleIds: [custom.body.data!.id] },
      cookie
    )
    expect(assigned.status, JSON.stringify(assigned.body)).toBe(200)

    const inUse = await del(`/platform-roles/${custom.body.data!.id}`, cookie)
    expect(inUse.status).toBe(409)
    expect(inUse.body.code).toBe(Code.ROLE_IN_USE)
  })

  it("applies PA-R2 to role authoring: no permissions beyond your own", async () => {
    const { cookie } = await signInSuperAdmin()
    const roleDesigner = await post<PlatformRoleDto>("/platform-roles", {
      key: "role_designer",
      name: "Role designer",
      permissions: ["read:platform-role", "create:platform-role", "update:platform-role"],
    }, cookie)
    expect(roleDesigner.status).toBe(201)
    const designer = await inviteAndJoin(cookie, "designer@avuny.dev", "Des Igner", [
      "role_designer",
    ])

    // Cloning super_admin would copy every permission: denied (PA-R2).
    const superRoleId = await roleIdByKey("super_admin")
    const clonedSuper = await post(`/platform-roles/${superRoleId}/clone`, {
      key: "super_clone",
      name: "Super clone",
    }, designer.cookie)
    expect(clonedSuper.status).toBe(403)
    expect(clonedSuper.body.code).toBe(Code.ESCALATION_DENIED)

    // Creating a role with a permission the designer does not hold: denied.
    const overreach = await post("/platform-roles", {
      key: "overreach",
      name: "Overreach",
      permissions: ["read:platform-role", "refund:platform-payment"],
    }, designer.cookie)
    expect(overreach.status).toBe(403)
    expect(overreach.body.code).toBe(Code.ESCALATION_DENIED)

    // Updating their own role within their permissions: fine.
    const okUpdate = await patch<PlatformRoleDto>(
      `/platform-roles/${roleDesigner.body.data!.id}`,
      { permissions: ["read:platform-role", "create:platform-role", "update:platform-role", "read:platform-dashboard"] },
      designer.cookie
    )
    // read:platform-dashboard is beyond the designer: also denied.
    expect(okUpdate.status).toBe(403)
    expect(okUpdate.body.code).toBe(Code.ESCALATION_DENIED)
  })

  it("gates role routes by permission (PA-R7)", async () => {
    const { cookie } = await signInSuperAdmin()
    const billing = await inviteAndJoin(cookie, "billing@avuny.dev", "Bill Ing", [
      "billing_admin",
    ])

    const denied = await get("/platform-roles", billing.cookie)
    expect(denied.status).toBe(403)
    expect(denied.body.code).toBe(Code.PERMISSION_DENIED)

    const readerRole = await post<PlatformRoleDto>("/platform-roles", {
      key: "role_reader",
      name: "Role reader",
      permissions: ["read:platform-role"],
    }, cookie)
    expect(readerRole.status, JSON.stringify(readerRole.body)).toBe(201)
    const reader = await inviteAndJoin(cookie, "reader@avuny.dev", "Read Er", [
      "role_reader",
    ])
    const listed = await get<PlatformRoleDto[]>("/platform-roles", reader.cookie)
    expect(listed.status, JSON.stringify(listed.body)).toBe(200)
    expect(listed.body.data!.map((role) => role.key)).toContain("super_admin")

    // Reading without create still cannot create (PA-R7).
    const createDenied = await post("/platform-roles", {
      key: "nope",
      name: "Nope",
      permissions: [],
    }, reader.cookie)
    expect(createDenied.status).toBe(403)
    expect(createDenied.body.code).toBe(Code.PERMISSION_DENIED)

    // The built-in viewer excludes role management entirely.
    const viewer = await inviteAndJoin(cookie, "viewer@avuny.dev", "View Er", ["viewer"])
    const viewerDenied = await get("/platform-roles", viewer.cookie)
    expect(viewerDenied.status).toBe(403)
    expect(viewerDenied.body.code).toBe(Code.PERMISSION_DENIED)
  })
})
