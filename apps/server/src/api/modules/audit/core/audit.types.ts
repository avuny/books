import type { AuditEventType } from "@avuny/contracts"

/**
 * Payload for writing a single audit event.
 * All fields are optional except eventType and outcome; pass only what you have.
 * Never include passwords, OTP codes, tokens or raw identifiers of unknown users (D13).
 */
export interface WriteAuditEventInput {
  eventType: AuditEventType
  outcome: "success" | "failure"
  actorUserId?: string
  subjectUserId?: string
  sessionId?: string
  /** Hex HMAC-SHA256(AUDIT_HMAC_SECRET, normalized identifier). Required for throttle events. */
  identifierHmac?: string
  ipAddress?: string
  userAgent?: string
  requestId?: string
  /** Masked display info and extra context. Never raw identifiers of unknown users. */
  metadata?: Record<string, unknown>
}
