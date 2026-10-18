import bcrypt from "bcryptjs"
import { config } from "../../../config.js"

// Precomputed bcrypt hash for dummy password comparisons (cost 12 / matching config)
const DUMMY_HASH =
  "$2a$12$e8Y6Z2eK7pW5yM2hU0LdI.98G3F2K1J0H4G3F2K1J0H4G3F2K1J0H"

/**
 * Hash password with bcryptjs using configured rounds (D6).
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, config.BCRYPT_ROUNDS)
}

/**
 * Compare password against bcrypt hash (D6).
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Dummy password compare to maintain constant response timing when an identifier does not exist (D6).
 */
export async function verifyDummyPassword(password: string): Promise<boolean> {
  return bcrypt.compare(password, DUMMY_HASH)
}
