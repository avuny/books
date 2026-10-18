import { describe, it, expect, vi, beforeEach } from "vitest"
import { OpenAPIHono } from "@hono/zod-openapi"
import { AuthErrorCode, OtpErrorCode } from "@avuny/contracts"
import { resetPassword } from "../../shell/auth.service.js"
import * as authRepo from "../../shell/auth.repo.js"
import * as usersModule from "../../../users/index.js"
import * as auditModule from "../../../audit/index.js"
import * as otpModule from "../../../otp/index.js"
import * as messagingModule from "../../../messaging/index.js"
import type { Database, User } from "@avuny/db"

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
  classifyIdentifier: vi.fn(),
  normalizeIdentifier: vi.fn((v: string) => v.trim().toLowerCase()),
  updateUserLastSignIn: vi.fn(),
  updateUserLastActive: vi.fn(),
  hashPassword: vi.fn().mockResolvedValue("new_hashed_password"),
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
  computeIdentifierHmac: vi.fn().mockReturnValue("hmac_test_identifier"),
}))

vi.mock("../../../otp/index.js", () => ({
  consumeVerificationProof: vi.fn(),
  issueOtp: vi.fn(),
  otpErrorsHttpMap: {
    OTP_INVALID: { statusCode: 400, responseMessage: "Invalid OTP" },
    OTP_RATE_LIMITED: { statusCode: 429, responseMessage: "Rate limited" },
    OTP_RESEND_TOO_SOON: {
      statusCode: 429,
      responseMessage: "Resend too soon",
    },
    VERIFICATION_TOKEN_INVALID: {
      statusCode: 400,
      responseMessage: "Invalid verification token",
    },
  },
}))

vi.mock("../../../messaging/index.js", () => ({
  getMessageSender: vi.fn(() => ({
    sendOtp: vi.fn().mockResolvedValue(undefined),
    sendSecurityNotice: vi.fn().mockResolvedValue(undefined),
  })),
}))

const mockDb = {} as Database

describe("auth.service - Slice 3: Forgot Password (resetPassword)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns WEAK_PASSWORD when new password is too short", async () => {
    const result = await resetPassword(mockDb, {
      verificationToken: "valid.jwt.token",
      newPassword: "short",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe(AuthErrorCode.WEAK_PASSWORD)
    }
    expect(otpModule.consumeVerificationProof).not.toHaveBeenCalled()
  })

  it("returns WEAK_PASSWORD when new password exceeds 72 UTF-8 bytes", async () => {
    const result = await resetPassword(mockDb, {
      verificationToken: "valid.jwt.token",
      newPassword: "A".repeat(73),
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe(AuthErrorCode.WEAK_PASSWORD)
    }
    expect(otpModule.consumeVerificationProof).not.toHaveBeenCalled()
  })

  it("returns VERIFICATION_TOKEN_INVALID when token verification fails", async () => {
    vi.mocked(otpModule.consumeVerificationProof).mockResolvedValueOnce({
      success: false,
      error: OtpErrorCode.VERIFICATION_TOKEN_INVALID,
      msg: "Token expired or invalid",
    })

    const result = await resetPassword(mockDb, {
      verificationToken: "invalid.jwt.token",
      newPassword: "ValidPassword123!",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe(OtpErrorCode.VERIFICATION_TOKEN_INVALID)
    }
    expect(authRepo.updateUserPassword).not.toHaveBeenCalled()
  })

  it("returns VERIFICATION_TOKEN_INVALID when user associated with token does not exist", async () => {
    vi.mocked(otpModule.consumeVerificationProof).mockResolvedValueOnce({
      success: true,
      data: {
        jti: "challenge-uuid",
        purpose: "FORGET_PASSWORD",
        identifier: "unknown@example.com",
        sub: "user-uuid-999",
      },
      msg: "Proof consumed",
    })
    vi.mocked(usersModule.findUserById).mockResolvedValueOnce(null)
    vi.mocked(usersModule.findUserByIdentifier).mockResolvedValueOnce(null)

    const result = await resetPassword(mockDb, {
      verificationToken: "valid.token",
      newPassword: "ValidPassword123!",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe(OtpErrorCode.VERIFICATION_TOKEN_INVALID)
    }
    expect(authRepo.updateUserPassword).not.toHaveBeenCalled()
  })

  it("resets password successfully, revoking all sessions with reason password_reset and auditing completion", async () => {
    const fakeUser: User = {
      id: "user-123",
      name: "Alice",
      passwordHash: "old_hashed_password",
      platformRole: "user",
      status: "active",
      avatarKey: null,
      suspendedAt: null,
      suspendedReason: null,
      lastSignInAt: null,
      lastActiveAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    vi.mocked(otpModule.consumeVerificationProof).mockResolvedValueOnce({
      success: true,
      data: {
        jti: "challenge-uuid",
        purpose: "FORGET_PASSWORD",
        identifier: "alice@example.com",
        sub: "user-123",
      },
      msg: "Proof consumed",
    })

    vi.mocked(usersModule.findUserById).mockResolvedValue({
      user: fakeUser,
      identifiers: [
        {
          id: "ident-1",
          userId: "user-123",
          type: "email",
          value: "alice@example.com",
          isPrimary: true,
          verifiedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    })

    const result = await resetPassword(mockDb, {
      verificationToken: "valid.proof.token",
      newPassword: "BrandNewSecurePassword123!",
      ipAddress: "192.168.1.50",
      userAgent: "Mozilla/5.0",
      requestId: "req-123",
    })

    expect(result.success).toBe(true)
    expect(usersModule.hashPassword).toHaveBeenCalledWith(
      "BrandNewSecurePassword123!"
    )
    expect(authRepo.updateUserPassword).toHaveBeenCalledWith(
      mockDb,
      "user-123",
      "new_hashed_password"
    )
    expect(authRepo.revokeAllSessionsForUser).toHaveBeenCalledWith(
      mockDb,
      "user-123",
      "password_reset"
    )
    expect(auditModule.writeAuditEvent).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        eventType: "auth.password_reset_completed",
        outcome: "success",
        subjectUserId: "user-123",
        ipAddress: "192.168.1.50",
        userAgent: "Mozilla/5.0",
        requestId: "req-123",
      })
    )
  })
})

describe("Hono routes - Slice 3: Forgot Password (D9 enumeration safety & rate limiting)", () => {
  let testApp: OpenAPIHono
  const mockSendOtp = vi.fn().mockResolvedValue(undefined)

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.mocked(messagingModule.getMessageSender).mockReturnValue({
      sendOtp: mockSendOtp,
      sendSecurityNotice: vi.fn().mockResolvedValue(undefined),
    })

    const { default: sendOtpRouter } =
      await import("../../hono-routes/forgot-password-send-otp.route.js")
    const { default: resetRouter } =
      await import("../../hono-routes/forgot-password-reset.route.js")

    testApp = new OpenAPIHono()
    testApp.route("/auth", sendOtpRouter)
    testApp.route("/auth", resetRouter)
  })

  describe("POST /auth/forgot-password/send-otp", () => {
    it("D9: returns 202 for unknown identifier, creates suppressed OTP row, and does NOT call message sender", async () => {
      vi.mocked(usersModule.findUserByIdentifier).mockResolvedValueOnce(null)
      vi.mocked(usersModule.classifyIdentifier).mockReturnValueOnce("email")
      vi.mocked(otpModule.issueOtp).mockResolvedValueOnce({
        success: true,
        data: {
          challengeId: "ch-suppressed-1",
          expiresAt: "2026-10-13T16:00:00Z",
          resendAvailableAt: "2026-10-13T15:31:00Z",
          code: "123456",
        },
        msg: "OTP issued",
      })

      const res = await testApp.request("/auth/forgot-password/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: "nonexistent@example.com" }),
      })

      expect(res.status).toBe(202)
      const json = (await res.json()) as {
        success: boolean
        data: { challengeId: string; code?: string }
      }
      expect(json.success).toBe(true)
      expect(json.data.challengeId).toBe("ch-suppressed-1")
      expect(json.data.code).toBeUndefined()

      // D9: issueOtp was called with isSuppressed: true and the normalized submitted identifier
      expect(otpModule.issueOtp).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          purpose: "FORGET_PASSWORD",
          identifier: "nonexistent@example.com",
          isSuppressed: true,
        })
      )

      // D9: Message sender was NOT called
      expect(mockSendOtp).not.toHaveBeenCalled()

      // Audit recorded with suppressed metadata
      expect(auditModule.writeAuditEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: "auth.password_reset_requested",
          outcome: "success",
          metadata: { suppressed: true },
        })
      )
    })

    it("D9: resolves primary verified email for a username and sends OTP to that email", async () => {
      vi.mocked(usersModule.classifyIdentifier).mockReturnValueOnce("username")
      vi.mocked(usersModule.findUserByIdentifier).mockResolvedValueOnce({
        user: { id: "user-alice" } as unknown as User,
        identifier: {
          type: "username",
          value: "alice",
          isPrimary: true,
        } as unknown as {
          type: "username"
          value: string
          id: string
          userId: string
          createdAt: Date
          updatedAt: Date
          verifiedAt: Date | null
          isPrimary: boolean
        },
      })
      vi.mocked(usersModule.findUserById).mockResolvedValueOnce({
        user: { id: "user-alice" } as unknown as User,
        identifiers: [
          {
            type: "email",
            value: "alice@example.com",
            isPrimary: true,
            verifiedAt: new Date(),
          } as unknown as {
            type: "email"
            value: string
            id: string
            userId: string
            createdAt: Date
            updatedAt: Date
            verifiedAt: Date | null
            isPrimary: boolean
          },
        ],
      })
      vi.mocked(otpModule.issueOtp).mockResolvedValueOnce({
        success: true,
        data: {
          challengeId: "ch-alice-1",
          expiresAt: "2026-10-13T16:00:00Z",
          resendAvailableAt: "2026-10-13T15:31:00Z",
          code: "654321",
        },
        msg: "OTP issued",
      })

      const res = await testApp.request("/auth/forgot-password/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: "alice" }),
      })

      expect(res.status).toBe(202)
      expect(otpModule.issueOtp).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          purpose: "FORGET_PASSWORD",
          identifier: "alice",
          userId: "user-alice",
          isSuppressed: false,
        })
      )

      expect(mockSendOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "alice@example.com",
          type: "email",
          code: "654321",
          purpose: "FORGET_PASSWORD",
        })
      )
    })

    it("D9: username with no verified email/phone is suppressed (no provider call, neutral response)", async () => {
      vi.mocked(usersModule.classifyIdentifier).mockReturnValueOnce("username")
      vi.mocked(usersModule.findUserByIdentifier).mockResolvedValueOnce({
        user: { id: "user-no-email" } as unknown as User,
        identifier: {
          type: "username",
          value: "bob",
          isPrimary: true,
        } as unknown as {
          type: "username"
          value: string
          id: string
          userId: string
          createdAt: Date
          updatedAt: Date
          verifiedAt: Date | null
          isPrimary: boolean
        },
      })
      vi.mocked(usersModule.findUserById).mockResolvedValueOnce({
        user: { id: "user-no-email" } as unknown as User,
        identifiers: [
          {
            type: "username",
            value: "bob",
            isPrimary: true,
            verifiedAt: new Date(),
          } as unknown as {
            type: "username"
            value: string
            id: string
            userId: string
            createdAt: Date
            updatedAt: Date
            verifiedAt: Date | null
            isPrimary: boolean
          },
        ],
      })
      vi.mocked(otpModule.issueOtp).mockResolvedValueOnce({
        success: true,
        data: {
          challengeId: "ch-bob-1",
          expiresAt: "2026-10-13T16:00:00Z",
          resendAvailableAt: "2026-10-13T15:31:00Z",
          code: "111222",
        },
        msg: "OTP issued",
      })

      const res = await testApp.request("/auth/forgot-password/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: "bob" }),
      })

      expect(res.status).toBe(202)
      expect(otpModule.issueOtp).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isSuppressed: true,
        })
      )
      expect(mockSendOtp).not.toHaveBeenCalled()
    })

    it("D9: returns 429 when suppressed send hits OTP_RATE_LIMITED (rate limited like a real one)", async () => {
      vi.mocked(usersModule.classifyIdentifier).mockReturnValueOnce("email")
      vi.mocked(usersModule.findUserByIdentifier).mockResolvedValueOnce(null)
      vi.mocked(otpModule.issueOtp).mockResolvedValueOnce({
        success: false,
        error: OtpErrorCode.OTP_RATE_LIMITED,
        msg: "Hourly send limit reached",
      })

      const res = await testApp.request("/auth/forgot-password/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: "unknown@example.com" }),
      })

      expect(res.status).toBe(429)
      const json: any = await res.json()
      expect(json.success).toBe(false)
      expect(json.code).toBe(OtpErrorCode.OTP_RATE_LIMITED)
    })

    it("returns 429 when cooldown is active (OTP_RESEND_TOO_SOON)", async () => {
      vi.mocked(usersModule.classifyIdentifier).mockReturnValueOnce("email")
      vi.mocked(usersModule.findUserByIdentifier).mockResolvedValueOnce(null)
      vi.mocked(otpModule.issueOtp).mockResolvedValueOnce({
        success: false,
        error: OtpErrorCode.OTP_RESEND_TOO_SOON,
        msg: "Resend cooldown active",
      })

      const res = await testApp.request("/auth/forgot-password/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: "unknown@example.com" }),
      })

      expect(res.status).toBe(429)
      const json: any = await res.json()
      expect(json.success).toBe(false)
      expect(json.code).toBe(OtpErrorCode.OTP_RESEND_TOO_SOON)
    })

    it("returns 400 for an unclassifiable identifier", async () => {
      vi.mocked(usersModule.classifyIdentifier).mockReturnValueOnce(null)

      const res = await testApp.request("/auth/forgot-password/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: "abc def" }),
      })

      expect(res.status).toBe(400)
      const json: any = await res.json()
      expect(json.code).toBe(OtpErrorCode.OTP_INVALID)
    })
  })

  describe("POST /auth/forgot-password/reset", () => {
    it("returns 204 on successful password reset", async () => {
      vi.mocked(otpModule.consumeVerificationProof).mockResolvedValueOnce({
        success: true,
        data: {
          jti: "ch-1",
          purpose: "FORGET_PASSWORD",
          identifier: "alice@example.com",
          sub: "user-alice",
        },
        msg: "Consumed",
      })
      vi.mocked(usersModule.findUserById).mockResolvedValueOnce({
        user: { id: "user-alice" } as unknown as User,
        identifiers: [],
      })

      const res = await testApp.request("/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationToken: "valid.token",
          newPassword: "BrandNewPassword123!",
        }),
      })

      expect(res.status).toBe(204)
    })

    it("returns 400 when verification token is invalid", async () => {
      vi.mocked(otpModule.consumeVerificationProof).mockResolvedValueOnce({
        success: false,
        error: OtpErrorCode.VERIFICATION_TOKEN_INVALID,
        msg: "Invalid token",
      })

      const res = await testApp.request("/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationToken: "bad.token",
          newPassword: "BrandNewPassword123!",
        }),
      })

      expect(res.status).toBe(400)
      const json: any = await res.json()
      expect(json.code).toBe(OtpErrorCode.VERIFICATION_TOKEN_INVALID)
    })

    it("returns 422 when new password exceeds 72 bytes (WEAK_PASSWORD)", async () => {
      const res = await testApp.request("/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationToken: "valid.token",
          newPassword: "A".repeat(73),
        }),
      })

      expect(res.status).toBe(422)
      const json: any = await res.json()
      expect(json.code).toBe(AuthErrorCode.WEAK_PASSWORD)
    })
  })
})
