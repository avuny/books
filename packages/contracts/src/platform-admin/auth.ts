import { z } from "@avuny/zod"
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH } from "../user/constants.js"

/**
 * Platform admin auth contracts (A1-04, PLATFORM-ADMIN-SPEC 3.2).
 * Login only, no register: an admin exists only via the bootstrap CLI or an
 * accepted invite, and TOTP enrollment is mandatory before the first session.
 */

/** Session cookie: __Host- prefix, separate from every tenant cookie (spec 2.4). */
export const PLATFORM_AUTH_COOKIE_NAME = "__Host-platform_session"
/** Path the session cookie is scoped to. */
export const PLATFORM_AUTH_COOKIE_PATH = "/api/platform-auth"

/** Single-purpose signed tickets between the two login/enrollment steps. */
export const PLATFORM_TICKET_TTL_MINUTES = 10

/** TOTP parameters (RFC 6238): SHA-1, 6 digits, 30s step, ±1 step tolerance. */
export const PLATFORM_TOTP_DIGITS = 6
export const PLATFORM_TOTP_PERIOD_SECONDS = 30
export const PLATFORM_TOTP_WINDOW_STEPS = 1
/** Bytes of randomness in a new TOTP secret (160 bits, RFC 4226 recommendation). */
export const PLATFORM_TOTP_SECRET_BYTES = 20

export const PlatformAuthErrorCode = {
  /**
   * The ONLY error the login and TOTP steps return for a bad email, password,
   * TOTP code, locked account or disabled account (spec 3.2: generic errors,
   * no account enumeration). The audit log keeps the real reason.
   */
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  /** The pending login / enrollment ticket is malformed, expired or reused. */
  INVALID_TICKET: "INVALID_TICKET",
  /** The invite token is unknown, expired, accepted or revoked. One code for all. */
  INVALID_INVITE: "INVALID_INVITE",
  /** Password breaks the shared password rules (min length / 72-byte bcrypt cap). */
  WEAK_PASSWORD: "WEAK_PASSWORD",
  /** No session cookie, or the session is expired, revoked or unknown. */
  UNAUTHENTICATED: "UNAUTHENTICATED",
  /** DELETE /sessions/{id}: not one of the caller's own live sessions. */
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
} as const
export type PlatformAuthErrorCode =
  (typeof PlatformAuthErrorCode)[keyof typeof PlatformAuthErrorCode]

const emailSchema = z.string().trim().toLowerCase().email().max(254)
const totpCodeSchema = z
  .string()
  .regex(new RegExp(`^\\d{${PLATFORM_TOTP_DIGITS}}$`), "TOTP code must be 6 digits")

const passwordSchema = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
  )
  .refine(
    (value) => new TextEncoder().encode(value).length <= PASSWORD_MAX_BYTES,
    `Password must not exceed ${PASSWORD_MAX_BYTES} bytes`
  )

/* ---- Login: step 1 (email + password) ---- */
export const PlatformLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
})
export type PlatformLoginInput = z.infer<typeof PlatformLoginSchema>

export const PlatformLoginResponseSchema = z.object({
  /** Signed single-purpose ticket for step 2; never a session. */
  pendingToken: z.string(),
  expiresAt: z.string().datetime(),
})
export type PlatformLoginResponse = z.infer<typeof PlatformLoginResponseSchema>

/* ---- Login: step 2 (TOTP) ---- */
export const PlatformLoginTotpSchema = z.object({
  pendingToken: z.string().min(1),
  code: totpCodeSchema,
})
export type PlatformLoginTotpInput = z.infer<typeof PlatformLoginTotpSchema>

export const PlatformAdminDtoSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  name: z.string(),
  status: z.enum(["invited", "active", "disabled"]),
  roles: z.array(z.string()),
  lastLoginAt: z.string().datetime().nullable(),
  totpEnabledAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})
export type PlatformAdminDto = z.infer<typeof PlatformAdminDtoSchema>

export const PlatformAuthSuccessSchema = z.object({
  admin: PlatformAdminDtoSchema,
  sessionExpiresAt: z.string().datetime(),
})
export type PlatformAuthSuccess = z.infer<typeof PlatformAuthSuccessSchema>

/* ---- Invite acceptance + TOTP enrollment ---- */
export const PlatformAcceptInviteSchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  password: passwordSchema,
})
export type PlatformAcceptInviteInput = z.infer<typeof PlatformAcceptInviteSchema>

export const PlatformAcceptInviteResponseSchema = z.object({
  /** Signed ticket carrying the pending enrollment; single use. */
  enrollmentTicket: z.string(),
  /** Base32 secret for manual entry; also encoded in otpauthUrl. Shown once. */
  totpSecret: z.string(),
  otpauthUrl: z.string(),
  expiresAt: z.string().datetime(),
})
export type PlatformAcceptInviteResponse = z.infer<
  typeof PlatformAcceptInviteResponseSchema
>

export const PlatformEnrollTotpSchema = z.object({
  enrollmentTicket: z.string().min(1),
  code: totpCodeSchema,
})
export type PlatformEnrollTotpInput = z.infer<typeof PlatformEnrollTotpSchema>

/* ---- Sessions ---- */
export const PlatformSessionDtoSchema = z.object({
  id: z.string().uuid(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  current: z.boolean(),
})
export type PlatformSessionDto = z.infer<typeof PlatformSessionDtoSchema>
