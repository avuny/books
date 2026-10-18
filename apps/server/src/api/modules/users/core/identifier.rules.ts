/**
 * Identifier rules (D1): classify, normalize and validate email, phone and username.
 *
 * Pure functions — no I/O, no config reads. Safe to use in core rules.
 */

// These mirror the patterns in packages/db/src/schema/user/identifier-patterns.ts
// We keep them here too so the application layer can validate without a DB round-trip.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const E164_RE = /^\+[1-9][0-9]{6,14}$/

export type IdentifierType = "email" | "phone" | "username"

/**
 * Classify an identifier value into its type.
 * Returns null if the value doesn't match any known type.
 */
export function classifyIdentifier(value: string): IdentifierType | null {
  if (!value || typeof value !== "string" || value.length < 3) return null
  if (EMAIL_RE.test(value)) return "email"
  if (E164_RE.test(value)) return "phone"
  // A username must not look like an email or phone; spaces are forbidden.
  if (value.trim() === value && !/\s/.test(value)) return "username"
  return null
}

/**
 * Normalize an identifier for storage and comparison (D1):
 * - email/username: trim + lowercase
 * - phone: already E.164; trim only (E.164 is case-insensitive by definition)
 */
export function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * Validate that a value can serve as the given type.
 * Returns an error string or null if valid.
 */
export function validateIdentifierForType(
  value: string,
  type: IdentifierType
): string | null {
  const normalized = normalizeIdentifier(value)
  if (type === "email") {
    if (!EMAIL_RE.test(normalized)) return "Invalid email address"
    return null
  }
  if (type === "phone") {
    if (!E164_RE.test(value.trim())) return "Invalid phone number (use E.164, e.g. +15551234567)"
    return null
  }
  // username
  if (normalized.length < 3) return "Username must be at least 3 characters"
  if (normalized.length > 32) return "Username must be at most 32 characters"
  if (EMAIL_RE.test(normalized)) return "Username cannot look like an email"
  if (E164_RE.test(normalized)) return "Username cannot look like a phone number"
  if (/\s/.test(normalized)) return "Username cannot contain spaces"
  return null
}

/**
 * Check whether an identifier type is a public sign-up type (email or phone).
 * Usernames cannot start a sign-up (ID-2).
 */
export function isEmailOrPhone(type: IdentifierType): boolean {
  return type === "email" || type === "phone"
}

/**
 * Return a masked version of an identifier for audit / log metadata.
 * Never log raw identifiers of unknown users (D13).
 * Examples: a***@mail.com, +20******12, us***ame
 */
export function maskIdentifier(value: string, type: IdentifierType): string {
  if (type === "email") {
    const [local, domain] = value.split("@")
    if (!local || !domain) return "***"
    return `${local[0]}***@${domain}`
  }
  if (type === "phone") {
    // Keep first 3 and last 2 digits.
    if (value.length <= 5) return "***"
    return `${value.slice(0, 3)}${"*".repeat(value.length - 5)}${value.slice(-2)}`
  }
  // username
  if (value.length <= 3) return "***"
  return `${value.slice(0, 2)}${"*".repeat(Math.min(value.length - 3, 6))}${value.slice(-1)}`
}
