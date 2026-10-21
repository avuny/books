import { z } from "@avuny/zod"
import "dotenv/config"
// Duration strings like "15m", "30d" are parsed to seconds.
function parseDuration(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value)

  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid duration: ${value}`)
  }

  const n = Number.parseInt(match[1], 10)
  const unit = match[2]

  switch (unit) {
    case "s":
      return n
    case "m":
      return n * 60
    case "h":
      return n * 3600
    case "d":
      return n * 86400
    default:
      throw new Error(`Unknown unit in duration: ${value}`)
  }
}

/**
 * A duration field with a string default, transformed into seconds.
 *
 * The default is applied before the transformation so omitted values
 * receive the expected default duration.
 */
const duration = (defaultValue: string) =>
  z
    .string()
    .default(defaultValue)
    .pipe(
      z
        .string()
        .regex(/^\d+[smhd]$/, "must be a duration like 15m, 30d")
        .transform(parseDuration)
    )

/**
 * Shared environment schema.
 *
 * This module intentionally does not access process.env or load dotenv.
 * Pass the appropriate environment object to loadConfig().
 */
export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    // Database
    DATABASE_URL: z.url(),

    // Tokens and sessions
    ACCESS_TOKEN_SECRET: z.string().min(32),
    ACCESS_TOKEN_TTL: duration("15m"),
    REFRESH_TOKEN_TTL: duration("30d"),
    SESSION_ABSOLUTE_TTL: duration("90d"),
    VERIFICATION_TOKEN_SECRET: z.string().min(32),
    VERIFICATION_TOKEN_TTL: duration("15m"),

    // Passwords and OTP
    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(31).default(12),
    OTP_SECRET: z.string().min(32),
    OTP_TTL: duration("10m"),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(5),
    OTP_RESEND_COOLDOWN: duration("60s"),
    OTP_MAX_SENDS_PER_HOUR: z.coerce.number().int().min(1).default(5),
    OTP_MAX_SENDS_PER_IP_PER_HOUR: z.coerce.number().int().min(1).default(20),

    // Sign-in throttling
    SIGNIN_MAX_FAILURES_PER_IDENTIFIER: z.coerce
      .number()
      .int()
      .min(1)
      .default(5),
    SIGNIN_MAX_FAILURES_PER_IP: z.coerce.number().int().min(1).default(20),
    SIGNIN_THROTTLE_WINDOW: duration("15m"),

    // Web / CORS
    COOKIE_SAMESITE: z.enum(["strict", "lax", "none"]).default("lax"),
    COOKIE_DOMAIN: z.string().optional(),
    CORS_ORIGINS: z
      .string()
      .default("")
      .transform((value) =>
        value
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean)
      ),
    TRUSTED_PROXY_IP_HEADER: z.string().default("x-forwarded-for"),

    // Background work
    BACKGROUND_RUNNER: z.enum(["waituntil", "node", "inline"]).default("node"),

    // Avatar / storage
    AVATAR_MAX_BYTES: z.coerce.number().int().positive().default(2097152),
    STORAGE_ENDPOINT: z.string().optional(),
    STORAGE_BUCKET: z.string().optional(),
    STORAGE_ACCESS_KEY: z.string().optional(),
    STORAGE_SECRET_KEY: z.string().optional(),
    STORAGE_PUBLIC_BASE_URL: z.string().optional(),

    // Delivery — email
    RESEND_API_KEY: z.string(),
    EMAIL_FROM: z.string(),
    EMAIL_HOST: z.string().optional(),
    EMAIL_PORT: z.coerce.number().int().optional(),
    EMAIL_USER: z.string().optional(),
    EMAIL_PASS: z.string().optional(),

    // Delivery — WhatsApp
    WHATSAPP_API_URL: z.string().optional(),
    WHATSAPP_API_TOKEN: z.string().optional(),
    WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
    WHATSAPP_OTP_TEMPLATE_NAME: z.string().optional(),
    WHATSAPP_API_VERSION: z.string().default("v23.0"),
    WHATSAPP_DEFAULT_LANG: z.string().default("en"),

    // Audit
    AUDIT_RETENTION_DAYS: z.coerce.number().int().positive().default(365),
    AUDIT_HMAC_SECRET: z.string().min(32),
  })
  .superRefine((data, ctx) => {
    // SESSION_ABSOLUTE_TTL must be >= REFRESH_TOKEN_TTL.
    if (data.SESSION_ABSOLUTE_TTL < data.REFRESH_TOKEN_TTL) {
      ctx.addIssue({
        code: "custom",
        path: ["SESSION_ABSOLUTE_TTL"],
        message: "SESSION_ABSOLUTE_TTL must be >= REFRESH_TOKEN_TTL",
      })
    }

    // Inline runner is refused in production.
    if (data.NODE_ENV === "production" && data.BACKGROUND_RUNNER === "inline") {
      ctx.addIssue({
        code: "custom",
        path: ["BACKGROUND_RUNNER"],
        message:
          "BACKGROUND_RUNNER=inline is not allowed in production (timing leak, D9)",
      })
    }

    // SameSite=none requires an explicit CORS_ORIGINS list.
    if (data.COOKIE_SAMESITE === "none" && data.CORS_ORIGINS.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["CORS_ORIGINS"],
        message: "CORS_ORIGINS must be set when COOKIE_SAMESITE=none",
      })
    }
  })

/**
 * Parses and validates environment variables.
 *
 * Accepts Node.js process.env or a Cloudflare Worker env binding object.
 * Invalid configuration throws an error with details.
 */
export function loadConfig(env: unknown) {
  const parsed = envSchema.safeParse(env)

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "<root>"
        return `  ${path}: ${issue.message}`
      })
      .join("\n")

    throw new Error(`Invalid environment variables:\n${details}`)
  }

  const config = {
    ...parsed.data,
    APP_NAME: "hono-worker-api",
    APP_VERSION: "1.0.0",
    API_BASE_PATH: "/api",
  }

  Object.freeze(config.CORS_ORIGINS)

  return Object.freeze(config)
}

export type AppConfig = ReturnType<typeof loadConfig>

/**
 * Default configuration singleton.
 *
 * Preserves existing imports:
 * import { config } from "../../../config.js"
 *
 * Requires process.env to be populated by the current runtime.
 */
let cached: AppConfig | undefined
export const getConfig = (env: unknown = process.env) =>
  (cached ??= loadConfig(env))

// keeps existing `import { config }` working
export const config = new Proxy({} as AppConfig, {
  get: (_, key) => getConfig()[key as keyof AppConfig],
})
