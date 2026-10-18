// ── OTP error codes ────────────────────────────────────────────────────────
export const OtpErrorCode = {
  OTP_INVALID: "OTP_INVALID",
  OTP_EXPIRED: "OTP_EXPIRED",
  OTP_ATTEMPTS_EXCEEDED: "OTP_ATTEMPTS_EXCEEDED",
  OTP_RESEND_TOO_SOON: "OTP_RESEND_TOO_SOON",
  OTP_RATE_LIMITED: "OTP_RATE_LIMITED",
  OTP_DELIVERY_FAILED: "OTP_DELIVERY_FAILED",
  VERIFICATION_TOKEN_INVALID: "VERIFICATION_TOKEN_INVALID",
} as const

export type OtpErrorCode = (typeof OtpErrorCode)[keyof typeof OtpErrorCode]

// ── Auth error codes ───────────────────────────────────────────────────────
export const AuthErrorCode = {
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED",
  TOO_MANY_ATTEMPTS: "TOO_MANY_ATTEMPTS",
  REFRESH_TOKEN_INVALID: "REFRESH_TOKEN_INVALID",
  REFRESH_TOKEN_REUSED: "REFRESH_TOKEN_REUSED",
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  WEAK_PASSWORD: "WEAK_PASSWORD",
  INVALID_CURRENT_PASSWORD: "INVALID_CURRENT_PASSWORD",
  INVALID_IDENTIFIER_TYPE: "INVALID_IDENTIFIER_TYPE",
} as const

export type AuthErrorCode =
  (typeof AuthErrorCode)[keyof typeof AuthErrorCode]

// ── Users error codes ──────────────────────────────────────────────────────
export const UsersErrorCode = {
  IDENTIFIER_ALREADY_EXISTS: "IDENTIFIER_ALREADY_EXISTS",
  IDENTIFIER_LIMIT_REACHED: "IDENTIFIER_LIMIT_REACHED",
  IDENTIFIER_NOT_FOUND: "IDENTIFIER_NOT_FOUND",
  IDENTIFIER_TYPE_MISMATCH: "IDENTIFIER_TYPE_MISMATCH",
  CANNOT_DELETE_PRIMARY_IDENTIFIER: "CANNOT_DELETE_PRIMARY_IDENTIFIER",
  CANNOT_DELETE_LAST_RECOVERY_IDENTIFIER:
    "CANNOT_DELETE_LAST_RECOVERY_IDENTIFIER",
  AVATAR_TOO_LARGE: "AVATAR_TOO_LARGE",
  AVATAR_INVALID_TYPE: "AVATAR_INVALID_TYPE",
} as const

export type UsersErrorCode =
  (typeof UsersErrorCode)[keyof typeof UsersErrorCode]

// ── Admin error codes ──────────────────────────────────────────────────────
export const AdminErrorCode = {
  CANNOT_SUSPEND_SELF: "CANNOT_SUSPEND_SELF",
  CANNOT_SUSPEND_ADMIN: "CANNOT_SUSPEND_ADMIN",
  USER_ALREADY_SUSPENDED: "USER_ALREADY_SUSPENDED",
  USER_NOT_SUSPENDED: "USER_NOT_SUSPENDED",
  USER_NOT_FOUND: "USER_NOT_FOUND",
} as const

export type AdminErrorCode =
  (typeof AdminErrorCode)[keyof typeof AdminErrorCode]
