/**
 * Shared constants validated on both client and server.
 * These are not env vars: only the API can read env, so values that clients also validate must be
 * constants here (§7 of the user module spec).
 */

// ── Password ───────────────────────────────────────────────────────────────
/** Minimum password length in Unicode characters. */
export const PASSWORD_MIN_LENGTH = 8 as const

/**
 * Maximum password length in UTF-8 bytes.
 * bcrypt silently truncates at 72 bytes; we reject anything longer instead (D6).
 */
export const PASSWORD_MAX_BYTES = 72 as const

// ── Identifiers ───────────────────────────────────────────────────────────
/** Maximum number of sign-in identifiers per user (email, phone, username combined). */
export const MAX_IDENTIFIERS_PER_USER = 4 as const

/** Minimum username length in characters (self-chosen; managed usernames are longer). */
export const USERNAME_MIN_LENGTH = 3 as const

/** Maximum username length for self-chosen usernames. Managed ones (name@orgslug) are longer. */
export const USERNAME_MAX_LENGTH = 32 as const

// ── User profile ──────────────────────────────────────────────────────────
/** Minimum user display name length in characters. */
export const NAME_MIN_LENGTH = 1 as const

/** Maximum user display name length in characters. */
export const NAME_MAX_LENGTH = 100 as const

// ── OTP ───────────────────────────────────────────────────────────────────
/** Length of the one-time code in digits. */
export const OTP_CODE_LENGTH = 6 as const

// ── Event types (audit_events.event_type) ─────────────────────────────────
/**
 * Closed list of <area>.<action> event types. The column is text (not a pg enum) so the list can
 * grow without a migration, but every event type must be registered here.
 */
export const AUDIT_EVENT_TYPES = {
  AUTH_SIGN_UP: "auth.sign_up",
  AUTH_SIGN_IN: "auth.sign_in",
  AUTH_SIGN_OUT: "auth.sign_out",
  AUTH_REFRESH_REUSE_DETECTED: "auth.refresh_reuse_detected",
  AUTH_PASSWORD_CHANGED: "auth.password_changed",
  AUTH_PASSWORD_RESET_REQUESTED: "auth.password_reset_requested",
  AUTH_PASSWORD_RESET_COMPLETED: "auth.password_reset_completed",
  SESSION_REVOKED: "session.revoked",
  USER_NAME_CHANGED: "user.name_changed",
  USER_AVATAR_CHANGED: "user.avatar_changed",
  USER_AVATAR_REMOVED: "user.avatar_removed",
  IDENTIFIER_ADDED: "identifier.added",
  IDENTIFIER_UPDATED: "identifier.updated",
  IDENTIFIER_REMOVED: "identifier.removed",
  IDENTIFIER_PRIMARY_CHANGED: "identifier.primary_changed",
  OTP_SENT: "otp.sent",
  OTP_VERIFY_FAILED: "otp.verify_failed",
  ADMIN_USER_VIEWED: "admin.user_viewed",
  ADMIN_USER_SUSPENDED: "admin.user_suspended",
  ADMIN_USER_REACTIVATED: "admin.user_reactivated",
  ADMIN_SESSIONS_REVOKED: "admin.sessions_revoked",
} as const

export type AuditEventType =
  (typeof AUDIT_EVENT_TYPES)[keyof typeof AUDIT_EVENT_TYPES]
