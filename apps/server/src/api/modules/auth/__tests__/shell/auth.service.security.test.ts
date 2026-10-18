import { describe, it, expect, vi, beforeEach } from "vitest"
import { AuthErrorCode } from "@avuny/contracts"
import {
  changePassword,
  signOutAll,
  listSessions,
  revokeUserSession,
} from "../../shell/auth.service.js"
import * as authRepo from "../../shell/auth.repo.js"
import * as usersModule from "../../../users/index.js"
import * as auditModule from "../../../audit/index.js"
import type { Database, User, Session } from "@avuny/db"

vi.mock("../../shell/auth.repo.js", () => ({
  createSession: vi.fn(),
  rotateSession: vi.fn(),
  revokeSession: vi.fn(),
  findSessionById: vi.fn(),
  findSessionByPreviousRefreshHash: vi.fn(),
  countFailedSignInsForIdentifier: vi.fn(),
  countFailedSignInsForIp: vi.fn(),
  findActiveSessionsForUser: vi.fn(),
  revokeAllSessionsExcept: vi.fn(),
  revokeAllSessionsForUser: vi.fn(),
  updateUserPassword: vi.fn(),
}))

vi.mock("../../../users/index.js", () => ({
  createUser: vi.fn(),
  findUserById: vi.fn(),
  findUserByIdentifier: vi.fn(),
  normalizeIdentifier: vi.fn((v: string) => v),
  updateUserLastSignIn: vi.fn(),
  updateUserLastActive: vi.fn(),
  hashPassword: vi.fn().mockResolvedValue("new_hashed_pw"),
  verifyPassword: vi.fn(),
  verifyDummyPassword: vi.fn(),
  validatePassword: vi.fn((pw: string) => {
    if (pw.length < 8) return "Password must be at least 8 characters"
    if (new TextEncoder().encode(pw).length > 72)
      return "Password must not exceed 72 bytes"
    return null
  }),
}))

vi.mock("../../../audit/index.js", () => ({
  writeAuditEvent: vi.fn().mockResolvedValue(undefined),
  computeIdentifierHmac: vi.fn().mockReturnValue("hmac_test"),
}))

const mockDb = {} as Database

describe("auth.service - Slice 2 Security: Password & Sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("changePassword", () => {
    it("returns WEAK_PASSWORD when new password is too short", async () => {
      const result = await changePassword(mockDb, {
        userId: "user-1",
        currentSessionId: "sess-1",
        currentPassword: "OldPassword123!",
        newPassword: "short",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe(AuthErrorCode.WEAK_PASSWORD)
      }
      expect(usersModule.verifyPassword).not.toHaveBeenCalled()
    })

    it("returns WEAK_PASSWORD when new password exceeds 72 UTF-8 bytes", async () => {
      const longPassword = "A".repeat(73)
      const result = await changePassword(mockDb, {
        userId: "user-1",
        currentSessionId: "sess-1",
        currentPassword: "OldPassword123!",
        newPassword: longPassword,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe(AuthErrorCode.WEAK_PASSWORD)
      }
      expect(usersModule.verifyPassword).not.toHaveBeenCalled()
    })

    it("returns INVALID_CURRENT_PASSWORD when current password does not match", async () => {
      vi.mocked(usersModule.findUserById).mockResolvedValueOnce({
        user: {
          id: "user-1",
          passwordHash: "existing_hash",
        } as unknown as User,
        identifiers: [],
      })
      vi.mocked(usersModule.verifyPassword).mockResolvedValueOnce(false)

      const result = await changePassword(mockDb, {
        userId: "user-1",
        currentSessionId: "sess-1",
        currentPassword: "WrongPassword!",
        newPassword: "ValidNewPassword123!",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe(AuthErrorCode.INVALID_CURRENT_PASSWORD)
      }
      expect(auditModule.writeAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          eventType: "auth.password_changed",
          outcome: "failure",
          subjectUserId: "user-1",
        })
      )
      expect(authRepo.updateUserPassword).not.toHaveBeenCalled()
    })

    it("successfully changes password and revokes all other sessions", async () => {
      vi.mocked(usersModule.findUserById).mockResolvedValueOnce({
        user: {
          id: "user-1",
          passwordHash: "existing_hash",
        } as unknown as User,
        identifiers: [],
      })
      vi.mocked(usersModule.verifyPassword).mockResolvedValueOnce(true)
      vi.mocked(usersModule.hashPassword).mockResolvedValueOnce("new_hash_123")

      const result = await changePassword(mockDb, {
        userId: "user-1",
        currentSessionId: "sess-1",
        currentPassword: "CorrectOldPassword!",
        newPassword: "ValidNewPassword123!",
      })

      expect(result.success).toBe(true)
      expect(authRepo.updateUserPassword).toHaveBeenCalledWith(
        mockDb,
        "user-1",
        "new_hash_123"
      )
      expect(authRepo.revokeAllSessionsExcept).toHaveBeenCalledWith(
        mockDb,
        "user-1",
        "sess-1",
        "password_changed"
      )
      expect(auditModule.writeAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          eventType: "auth.password_changed",
          outcome: "success",
          subjectUserId: "user-1",
          sessionId: "sess-1",
        })
      )
    })
  })

  describe("signOutAll", () => {
    it("revokes all sessions for the user and audits event", async () => {
      const result = await signOutAll(mockDb, {
        userId: "user-1",
        sessionId: "sess-1",
      })

      expect(result.success).toBe(true)
      expect(authRepo.revokeAllSessionsForUser).toHaveBeenCalledWith(
        mockDb,
        "user-1",
        "sign_out_all"
      )
      expect(auditModule.writeAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          eventType: "auth.sign_out",
          outcome: "success",
          subjectUserId: "user-1",
        })
      )
    })
  })

  describe("listSessions", () => {
    it("returns active sessions and accurately marks current session", async () => {
      const date = new Date()
      vi.mocked(authRepo.findActiveSessionsForUser).mockResolvedValueOnce([
        {
          id: "sess-1",
          userId: "user-1",
          platform: "web",
          deviceName: null,
          ipAddress: "127.0.0.1",
          createdAt: date,
          updatedAt: date,
          lastUsedAt: date,
          expiresAt: new Date(Date.now() + 100000),
          revokedAt: null,
          revokedReason: null,
          refreshTokenHash: "hash1",
          previousRefreshTokenHash: null,
          userAgent: null,
        },
        {
          id: "sess-2",
          userId: "user-1",
          platform: "mobile",
          deviceName: "iPhone 15",
          ipAddress: null,
          createdAt: date,
          updatedAt: date,
          lastUsedAt: date,
          expiresAt: new Date(Date.now() + 100000),
          revokedAt: null,
          revokedReason: null,
          refreshTokenHash: "hash2",
          previousRefreshTokenHash: null,
          userAgent: null,
        },
      ])

      const result = await listSessions(mockDb, {
        userId: "user-1",
        currentSessionId: "sess-1",
      })

      expect(result).toHaveLength(2)
      const [first, second] = result
      expect(first?.current).toBe(true)
      expect(second?.current).toBe(false)
      expect(second?.deviceName).toBe("iPhone 15")
    })
  })

  describe("revokeUserSession", () => {
    it("returns SESSION_NOT_FOUND when session does not exist or belongs to another user", async () => {
      vi.mocked(authRepo.findSessionById).mockResolvedValueOnce(null)

      const result = await revokeUserSession(mockDb, {
        userId: "user-1",
        targetSessionId: "non-existent",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe(AuthErrorCode.SESSION_NOT_FOUND)
      }
      expect(authRepo.revokeSession).not.toHaveBeenCalled()
    })

    it("returns SESSION_NOT_FOUND when session belongs to a different user", async () => {
      vi.mocked(authRepo.findSessionById).mockResolvedValueOnce({
        id: "sess-2",
        userId: "user-OTHER",
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      } as unknown as Session)

      const result = await revokeUserSession(mockDb, {
        userId: "user-1",
        targetSessionId: "sess-2",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe(AuthErrorCode.SESSION_NOT_FOUND)
      }
      expect(authRepo.revokeSession).not.toHaveBeenCalled()
    })

    it("successfully revokes user session and writes audit event", async () => {
      vi.mocked(authRepo.findSessionById).mockResolvedValueOnce({
        id: "sess-2",
        userId: "user-1",
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      } as unknown as Session)

      const result = await revokeUserSession(mockDb, {
        userId: "user-1",
        targetSessionId: "sess-2",
      })

      expect(result.success).toBe(true)
      expect(authRepo.revokeSession).toHaveBeenCalledWith(
        mockDb,
        "sess-2",
        "sign_out"
      )
      expect(auditModule.writeAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          eventType: "session.revoked",
          outcome: "success",
          subjectUserId: "user-1",
          sessionId: "sess-2",
        })
      )
    })
  })
})
