import { z } from "@avuny/zod"
import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  NAME_MIN_LENGTH,
  NAME_MAX_LENGTH,
  OTP_CODE_LENGTH,
} from "./user-module.constants.js"

// ── Identifier ─────────────────────────────────────────────────────────────

/** Any identifier value (email, phone or username). */
export const IdentifierValueSchema = z.string().min(3).max(254).trim()

/** Public-facing identifier for sign-up / OTP sends (email or phone only). */
export const EmailOrPhoneSchema = z
  .string()
  .min(3)
  .max(254)
  .trim()
  .toLowerCase()

// ── OTP ────────────────────────────────────────────────────────────────────

export const VerifyOtpBodySchema = z.object({
  challengeId: z.string().uuid(),
  code: z
    .string()
    .length(OTP_CODE_LENGTH)
    .regex(/^\d+$/, "OTP code must be digits only"),
})

export const VerifyOtpResponseSchema = z.object({
  verificationToken: z.string(),
  expiresAt: z.string().datetime(),
})

export const SendOtpResponseSchema = z.object({
  challengeId: z.string().uuid(),
  expiresAt: z.string().datetime(),
  resendAvailableAt: z.string().datetime(),
})

// ── Auth ───────────────────────────────────────────────────────────────────

export const SignUpSendOtpBodySchema = z.object({
  /** Email or phone; normalized server-side. */
  identifier: EmailOrPhoneSchema,
})

export const SignUpBodySchema = z.object({
  identifier: EmailOrPhoneSchema,
  name: z.string().min(NAME_MIN_LENGTH).max(NAME_MAX_LENGTH).trim(),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`),
  verificationToken: z.string(),
})

export const SignInBodySchema = z.object({
  /** Any identifier type: email, phone or username. */
  identifier: IdentifierValueSchema,
  password: z.string().min(1),
})

export const RefreshBodySchema = z
  .object({
    /** Mobile only: refresh token in body. Web sends it via cookie. */
    refreshToken: z.string().optional(),
  })
  .optional()
  .default({})

export const TokensSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: z.string().datetime(),
  /** Mobile only: refresh token in body. Web gets it in HttpOnly cookie. */
  refreshToken: z.string().optional(),
})

/** Minimal user profile returned with auth responses. */
export const AuthUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  /** Primary identifier value. */
  identifier: z.string(),
  identifierType: z.enum(["email", "phone", "username"]),
  avatarUrl: z.string().nullable(),
  platformRole: z.enum(["user", "support", "admin"]),
})

export const AuthResponseSchema = z.object({
  user: AuthUserSchema,
  tokens: TokensSchema,
})

export const RefreshResponseSchema = z.object({
  tokens: TokensSchema,
})

export const ChangePasswordBodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(
      PASSWORD_MIN_LENGTH,
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
    ),
})

// ── Forgot password (Slice 3) ─────────────────────────────────────────────

export const ForgotPasswordSendOtpBodySchema = z.object({
  /** Any identifier type: email, phone or username. */
  identifier: IdentifierValueSchema,
})

export const ForgotPasswordResetBodySchema = z.object({
  verificationToken: z.string(),
  newPassword: z
    .string()
    .min(
      PASSWORD_MIN_LENGTH,
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
    ),
})

// ── Session list (Slice 2) ────────────────────────────────────────────────

export const SessionItemSchema = z.object({
  id: z.string().uuid(),
  platform: z.enum(["web", "mobile"]),
  deviceName: z.string().nullable(),
  ipAddress: z.string().nullable(),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime(),
  current: z.boolean(),
})

export const SessionsListResponseSchema = z.array(SessionItemSchema)

// ── Users/me ───────────────────────────────────────────────────────────────

export const IdentifierSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["email", "phone", "username"]),
  value: z.string(),
  isPrimary: z.boolean(),
  verifiedAt: z.string().datetime().nullable(),
})

export const MeResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  platformRole: z.enum(["user", "support", "admin"]),
  identifiers: z.array(IdentifierSchema),
})

// ── Slice 4a — Update profile name ────────────────────────────────────────

/** Body for PATCH /users/me. Only name is editable in 4a; future fields extend this. */
export const UpdateProfileBodySchema = z.object({
  name: z.string().min(NAME_MIN_LENGTH).max(NAME_MAX_LENGTH).trim(),
})

/** Response for PATCH /users/me: the updated profile (same shape as GET). */
export const UpdateProfileResponseSchema = MeResponseSchema

// ── Admin ──────────────────────────────────────────────────────────────────

/** Query params for GET /admin/users (AD-1). */
export const AdminUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
  status: z.enum(["active", "suspended"]).optional(),
  identifierType: z.enum(["email", "phone", "username"]).optional(),
  createdFrom: z.string().datetime().optional(),
  createdTo: z.string().datetime().optional(),
  lastActiveFrom: z.string().datetime().optional(),
  lastActiveTo: z.string().datetime().optional(),
  sortBy: z.enum(["createdAt", "lastSignInAt", "name"]).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
})

export const AdminUserSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: z.enum(["active", "suspended"]),
  platformRole: z.enum(["user", "support", "admin"]),
  avatarUrl: z.string().nullable(),
  primaryIdentifier: z.object({
    type: z.enum(["email", "phone", "username"]),
    value: z.string(),
  }).nullable(),
  lastSignInAt: z.string().datetime().nullable(),
  lastActiveAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})

export const AdminUsersResponseSchema = z.object({
  items: z.array(AdminUserSummarySchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
})

/** Response for GET /admin/users/:id (AD-2). */
export const AdminUserDetailSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: z.enum(["active", "suspended"]),
  platformRole: z.enum(["user", "support", "admin"]),
  avatarUrl: z.string().nullable(),
  suspendedAt: z.string().datetime().nullable(),
  suspendedReason: z.string().nullable(),
  lastSignInAt: z.string().datetime().nullable(),
  lastActiveAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  identifiers: z.array(
    z.object({
      id: z.string().uuid(),
      type: z.enum(["email", "phone", "username"]),
      value: z.string(),
      isPrimary: z.boolean(),
      verifiedAt: z.string().datetime().nullable(),
    })
  ),
  activeSessions: z.array(
    z.object({
      id: z.string().uuid(),
      platform: z.enum(["web", "mobile"]),
      deviceName: z.string().nullable(),
      ipAddress: z.string().nullable(),
      lastUsedAt: z.string().datetime(),
      createdAt: z.string().datetime(),
    })
  ),
  recentActivity: z.array(
    z.object({
      id: z.string().uuid(),
      eventType: z.string(),
      outcome: z.enum(["success", "failure"]),
      ipAddress: z.string().nullable(),
      userAgent: z.string().nullable(),
      metadata: z.record(z.string(), z.unknown()),
      occurredAt: z.string().datetime(),
    })
  ),
})

/** Body for POST /admin/users/:id/suspend (AD-3). */
export const AdminSuspendBodySchema = z.object({
  reason: z.string().min(1).max(500).trim(),
})

/** Query params for GET /admin/activity (AD-4). */
export const AdminActivityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  subjectUserId: z.string().uuid().optional(),
  eventType: z.string().optional(),
  outcome: z.enum(["success", "failure"]).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  ipAddress: z.string().optional(),
})

export const AdminActivityItemSchema = z.object({
  id: z.string().uuid(),
  eventType: z.string(),
  outcome: z.enum(["success", "failure"]),
  actorUserId: z.string().uuid().nullable(),
  subjectUserId: z.string().uuid().nullable(),
  sessionId: z.string().uuid().nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  requestId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  occurredAt: z.string().datetime(),
})

export const AdminActivityResponseSchema = z.object({
  items: z.array(AdminActivityItemSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
})

/** Query params for GET /admin/metrics/overview (AD-5). */
export const AdminMetricsQuerySchema = z.object({
  range: z.enum(["7d", "30d", "90d"]).default("30d"),
})

export const AdminMetricsResponseSchema = z.object({
  range: z.enum(["7d", "30d", "90d"]),
  totalUsers: z.number().int(),
  newUsers: z.number().int(),
  activeUsers: z.object({
    dau: z.number().int(),
    wau: z.number().int(),
    mau: z.number().int(),
  }),
  suspendedUsers: z.number().int(),
  signIns: z.object({
    success: z.number().int(),
    failure: z.number().int(),
  }),
  signUpsPerDay: z.array(
    z.object({
      date: z.string(),
      count: z.number().int(),
    })
  ),
})

// ── Password validation helper (shared constant check) ────────────────────

/**
 * Validates password byte length (bcrypt truncates at 72 bytes; we reject instead).
 * Returns null if valid, an error string if not.
 */
export function validatePasswordBytes(password: string): string | null {
  const bytes = new TextEncoder().encode(password).length
  if (bytes > PASSWORD_MAX_BYTES) {
    return `Password must not exceed ${PASSWORD_MAX_BYTES} bytes`
  }
  return null
}
