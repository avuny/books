import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_BYTES,
} from "@avuny/contracts"

/**
 * Validates password rules (D6):
 * - Minimum 8 characters
 * - Maximum 72 UTF-8 bytes (bcryptjs truncates beyond 72 bytes; we reject instead)
 * Returns error string or null if valid.
 */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
  }
  const bytes = new TextEncoder().encode(password).length
  if (bytes > PASSWORD_MAX_BYTES) {
    return `Password must not exceed ${PASSWORD_MAX_BYTES} bytes`
  }
  return null
}
