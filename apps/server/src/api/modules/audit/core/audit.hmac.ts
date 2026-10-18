import crypto from "node:crypto"
import { config } from "../../../config.js"

/**
 * Computes identifier_hmac (D10):
 * hex HMAC-SHA256(AUDIT_HMAC_SECRET, normalized submitted identifier).
 * Used for throttling and correlation without storing or logging raw identifiers.
 */
export function computeIdentifierHmac(normalizedIdentifier: string): string {
  return crypto
    .createHmac("sha256", config.AUDIT_HMAC_SECRET)
    .update(normalizedIdentifier)
    .digest("hex")
}
