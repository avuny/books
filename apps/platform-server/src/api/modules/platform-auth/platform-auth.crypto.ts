import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto"
import {
  PLATFORM_TICKET_TTL_MINUTES,
  PLATFORM_TOTP_DIGITS,
  PLATFORM_TOTP_PERIOD_SECONDS,
  PLATFORM_TOTP_SECRET_BYTES,
  PLATFORM_TOTP_WINDOW_STEPS,
} from "@avuny/contracts/platform-admin"
import { config } from "../../config.js"

/**
 * Platform auth cryptography (A1-04). node:crypto only (the worker runs with
 * nodejs_compat). No secrets are ever logged or returned beyond the one-time
 * TOTP enrollment response (PA-R11).
 */

/* ------------------------------------------------------------------ TOTP (RFC 6238) */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

export const base32Encode = (bytes: Uint8Array): string => {
  let bits = 0
  let value = 0
  let out = ""
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  return out
}

export const base32Decode = (encoded: string): Uint8Array => {
  const clean = encoded.replace(/=+$/, "").toUpperCase()
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char)
    if (idx === -1) throw new Error("Invalid base32 character")
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

/** New random TOTP secret, base32-encoded (this is what the authenticator shows). */
export const generateTotpSecret = (): string =>
  base32Encode(randomBytes(PLATFORM_TOTP_SECRET_BYTES))

/** 6-digit code for the time step containing `forTime`, plus `stepOffset` steps. */
export const totpCode = (
  secretBase32: string,
  stepOffset = 0,
  forTime: number = Date.now()
): string => {
  const counter =
    Math.floor(forTime / 1000 / PLATFORM_TOTP_PERIOD_SECONDS) + stepOffset
  const counterBytes = Buffer.alloc(8)
  counterBytes.writeBigUInt64BE(BigInt(counter))
  const digest = createHmac("sha1", Buffer.from(base32Decode(secretBase32)))
    .update(counterBytes)
    .digest()
  const offset = digest[digest.length - 1]! & 0x0f
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    (digest[offset + 1]! << 16) |
    (digest[offset + 2]! << 8) |
    digest[offset + 3]!
  return (binary % 10 ** PLATFORM_TOTP_DIGITS)
    .toString()
    .padStart(PLATFORM_TOTP_DIGITS, "0")
}

/** Constant-time check of a code against the current step ± the configured window. */
export const verifyTotp = (secretBase32: string, code: string): boolean => {
  if (!new RegExp(`^\\d{${PLATFORM_TOTP_DIGITS}}$`).test(code)) return false
  for (let step = -PLATFORM_TOTP_WINDOW_STEPS; step <= PLATFORM_TOTP_WINDOW_STEPS; step++) {
    const expected = totpCode(secretBase32, step)
    if (
      timingSafeEqual(Buffer.from(code, "utf8"), Buffer.from(expected, "utf8"))
    ) {
      return true
    }
  }
  return false
}

/** otpauth:// URL authenticator apps can scan/click. */
export const buildOtpauthUrl = (secretBase32: string, email: string): string => {
  const issuer = "Avuny Platform"
  const label = encodeURIComponent(`${issuer}:${email}`)
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: String(PLATFORM_TOTP_DIGITS),
    period: String(PLATFORM_TOTP_PERIOD_SECONDS),
  })
  return `otpauth://totp/${label}?${params.toString()}`
}

/* ------------------------------------------------- TOTP secret encryption at rest */

const totpEncryptionKey = (): Buffer =>
  createHash("sha256").update(config.PLATFORM_TOTP_ENC_KEY, "utf8").digest()

/** AES-256-GCM: base64url(iv).base64url(ciphertext+tag). Key is SHA-256 of the env secret. */
export const encryptTotpSecret = (plain: string): string => {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", totpEncryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("base64url")}.${Buffer.concat([ciphertext, tag]).toString("base64url")}`
}

export const decryptTotpSecret = (encoded: string): string => {
  const [ivPart, dataPart] = encoded.split(".")
  if (!ivPart || !dataPart) throw new Error("Malformed encrypted TOTP secret")
  const data = Buffer.from(dataPart, "base64url")
  const ciphertext = data.subarray(0, data.length - 16)
  const tag = data.subarray(data.length - 16)
  const decipher = createDecipheriv(
    "aes-256-gcm",
    totpEncryptionKey(),
    Buffer.from(ivPart, "base64url")
  )
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
}

/* ----------------------------------------------------------- Signed auth tickets */

export type PlatformTicketPurpose = "login" | "enroll"

export interface PlatformTicketPayload {
  /** Purpose: a login ticket never enrolls and vice versa. */
  pur: PlatformTicketPurpose
  /** login: admin id. enroll: invite id. */
  sub: string
  /** enroll only: the admin created at invite acceptance. */
  aid?: string
  /** enroll only: the pending TOTP secret (the client already saw it once). */
  sec?: string
  /** Expiry, unix seconds. */
  exp: number
}

const ticketKey = (): Buffer =>
  createHash("sha256").update(config.PLATFORM_AUTH_TICKET_SECRET, "utf8").digest()

const sign = (data: string): string =>
  createHmac("sha256", ticketKey()).update(data, "utf8").digest("base64url")

/**
 * Short-lived single-purpose ticket between auth steps (password -> TOTP,
 * invite acceptance -> enrollment). Stateless and HMAC-signed; it never
 * authenticates anything by itself.
 */
export const signTicket = (
  payload: Omit<PlatformTicketPayload, "exp">,
  ttlMinutes: number = PLATFORM_TICKET_TTL_MINUTES
): { token: string; expiresAt: Date } => {
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000)
  const full: PlatformTicketPayload = {
    ...payload,
    exp: Math.floor(expiresAt.getTime() / 1000),
  }
  const body = Buffer.from(JSON.stringify(full), "utf8").toString("base64url")
  return { token: `${body}.${sign(body)}`, expiresAt }
}

export const verifyTicket = (
  token: string,
  purpose: PlatformTicketPurpose
): PlatformTicketPayload | null => {
  const dot = token.lastIndexOf(".")
  if (dot <= 0) return null
  const body = token.slice(0, dot)
  const signature = token.slice(dot + 1)
  const expected = sign(body)
  const a = Buffer.from(signature, "utf8")
  const b = Buffer.from(expected, "utf8")
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as PlatformTicketPayload
    if (payload.pur !== purpose) return null
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) {
      return null
    }
    return payload
  } catch {
    return null
  }
}
