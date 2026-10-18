import { describe, it, expect, vi, beforeEach } from "vitest"
import { AdminErrorCode } from "@avuny/contracts"
import {
  suspendUserAction,
  reactivateUserAction,
  revokeUserSessionsAction,
} from "../../shell/admin.service.js"
import * as adminRepo from "../../shell/admin.repo.js"
import * as auditModule from "../../../audit/index.js"
import type { Database } from "@avuny/db"

vi.mock("../../shell/admin.repo.js", () => ({
  findAdminUserDetail: vi.fn(),
  suspendUser: vi.fn(),
  reactivateUser: vi.fn(),
  revokeAllUserSessions: vi.fn(),
  listAdminUsers: vi.fn(),
  listAdminActivity: vi.fn(),
  getAdminMetrics: vi.fn(),
}))

vi.mock("../../../audit/index.js", () => ({
  writeAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

const mockDb = {} as Database

const baseUserDetail: NonNullable<Awaited<ReturnType<typeof adminRepo.findAdminUserDetail>>> = {
  id: "user-target-1",
  name: "Target User",
  status: "active",
  platformRole: "user",
  avatarKey: null,
  suspendedAt: null,
  suspendedReason: null,
  lastSignInAt: null,
  lastActiveAt: null,
  createdAt: new Date(),
  identifiers: [],
  activeSessions: [],
  recentActivity: [],
}

describe("admin.service business logic & guardrails (AD-3)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("suspendUserAction", () => {
    it("returns CANNOT_SUSPEND_SELF when actor tries to suspend themselves", async () => {
      const result = await suspendUserAction(mockDb, {
        actorUserId: "user-1",
        targetUserId: "user-1",
        reason: "Test reason",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe(AdminErrorCode.CANNOT_SUSPEND_SELF)
      }
      expect(adminRepo.suspendUser).not.toHaveBeenCalled()
    })

    it("returns USER_NOT_FOUND when target user does not exist", async () => {
      vi.mocked(adminRepo.findAdminUserDetail).mockResolvedValueOnce(null)

      const result = await suspendUserAction(mockDb, {
        actorUserId: "admin-1",
        targetUserId: "non-existent-user",
        reason: "Test reason",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe(AdminErrorCode.USER_NOT_FOUND)
      }
      expect(adminRepo.suspendUser).not.toHaveBeenCalled()
    })

    it("returns CANNOT_SUSPEND_ADMIN when target user has platformRole 'admin'", async () => {
      vi.mocked(adminRepo.findAdminUserDetail).mockResolvedValueOnce({
        ...baseUserDetail,
        id: "admin-2",
        platformRole: "admin",
      })

      const result = await suspendUserAction(mockDb, {
        actorUserId: "admin-1",
        targetUserId: "admin-2",
        reason: "Test reason",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe(AdminErrorCode.CANNOT_SUSPEND_ADMIN)
      }
      expect(adminRepo.suspendUser).not.toHaveBeenCalled()
    })

    it("returns USER_ALREADY_SUSPENDED when target user is already suspended", async () => {
      vi.mocked(adminRepo.findAdminUserDetail).mockResolvedValueOnce({
        ...baseUserDetail,
        id: "user-target-1",
        status: "suspended",
      })

      const result = await suspendUserAction(mockDb, {
        actorUserId: "admin-1",
        targetUserId: "user-target-1",
        reason: "Test reason",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe(AdminErrorCode.USER_ALREADY_SUSPENDED)
      }
      expect(adminRepo.suspendUser).not.toHaveBeenCalled()
    })

    it("suspends active user and writes audit event on valid request", async () => {
      vi.mocked(adminRepo.findAdminUserDetail).mockResolvedValueOnce({
        ...baseUserDetail,
        id: "user-target-1",
        status: "active",
        platformRole: "user",
      })
      vi.mocked(adminRepo.suspendUser).mockResolvedValueOnce(undefined)

      const result = await suspendUserAction(mockDb, {
        actorUserId: "admin-1",
        targetUserId: "user-target-1",
        reason: "Violation of terms",
        sessionId: "sess-1",
      })

      expect(result.success).toBe(true)
      expect(adminRepo.suspendUser).toHaveBeenCalledWith(
        mockDb,
        "user-target-1",
        "Violation of terms"
      )
      expect(auditModule.writeAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          eventType: "admin.user_suspended",
          outcome: "success",
          actorUserId: "admin-1",
          subjectUserId: "user-target-1",
          sessionId: "sess-1",
        })
      )
    })
  })

  describe("reactivateUserAction", () => {
    it("returns USER_NOT_FOUND when target user does not exist", async () => {
      vi.mocked(adminRepo.findAdminUserDetail).mockResolvedValueOnce(null)

      const result = await reactivateUserAction(mockDb, {
        actorUserId: "admin-1",
        targetUserId: "non-existent",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe(AdminErrorCode.USER_NOT_FOUND)
      }
    })

    it("returns USER_NOT_SUSPENDED when target user is active", async () => {
      vi.mocked(adminRepo.findAdminUserDetail).mockResolvedValueOnce({
        ...baseUserDetail,
        status: "active",
      })

      const result = await reactivateUserAction(mockDb, {
        actorUserId: "admin-1",
        targetUserId: "user-target-1",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe(AdminErrorCode.USER_NOT_SUSPENDED)
      }
      expect(adminRepo.reactivateUser).not.toHaveBeenCalled()
    })

    it("reactivates suspended user and writes audit event", async () => {
      vi.mocked(adminRepo.findAdminUserDetail).mockResolvedValueOnce({
        ...baseUserDetail,
        status: "suspended",
      })
      vi.mocked(adminRepo.reactivateUser).mockResolvedValueOnce(undefined)

      const result = await reactivateUserAction(mockDb, {
        actorUserId: "admin-1",
        targetUserId: "user-target-1",
      })

      expect(result.success).toBe(true)
      expect(adminRepo.reactivateUser).toHaveBeenCalledWith(mockDb, "user-target-1")
      expect(auditModule.writeAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          eventType: "admin.user_reactivated",
          outcome: "success",
          actorUserId: "admin-1",
          subjectUserId: "user-target-1",
        })
      )
    })
  })

  describe("revokeUserSessionsAction", () => {
    it("returns USER_NOT_FOUND when target user does not exist", async () => {
      vi.mocked(adminRepo.findAdminUserDetail).mockResolvedValueOnce(null)

      const result = await revokeUserSessionsAction(mockDb, {
        actorUserId: "admin-1",
        targetUserId: "non-existent",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe(AdminErrorCode.USER_NOT_FOUND)
      }
      expect(adminRepo.revokeAllUserSessions).not.toHaveBeenCalled()
    })

    it("revokes all sessions and writes audit event", async () => {
      vi.mocked(adminRepo.findAdminUserDetail).mockResolvedValueOnce(baseUserDetail)
      vi.mocked(adminRepo.revokeAllUserSessions).mockResolvedValueOnce(undefined)

      const result = await revokeUserSessionsAction(mockDb, {
        actorUserId: "admin-1",
        targetUserId: "user-target-1",
      })

      expect(result.success).toBe(true)
      expect(adminRepo.revokeAllUserSessions).toHaveBeenCalledWith(
        mockDb,
        "user-target-1"
      )
      expect(auditModule.writeAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          eventType: "admin.sessions_revoked",
          outcome: "success",
          actorUserId: "admin-1",
          subjectUserId: "user-target-1",
        })
      )
    })
  })
})
