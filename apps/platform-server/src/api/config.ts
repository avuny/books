import { z } from "@avuny/zod"

/**
 * Platform server environment schema (scaffold).
 *
 * Only values the scaffold uses are listed. Each later phase adds its own
 * (session secret in A1, database in A1, provider secrets in S6, ...), see
 * docs/modules/saas-architecture/PROGRESS.md. Never put secrets in wrangler.jsonc vars.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Postgres connection string (same Neon HTTP driver as apps/server). Optional only
  // because the health scaffold does not use it; every module route requires it.
  DATABASE_URL: z.string().min(1).optional(),

  // Platform auth (A1-04). Separate secrets from the tenant server: a tenant token
  // must never authenticate here and the reverse (PLATFORM-ADMIN-SPEC 2.4).
  // bcryptjs cost factor, same convention as apps/server.
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(31).default(12),
  // HMAC secret for the short-lived login/enrollment tickets between auth steps.
  PLATFORM_AUTH_TICKET_SECRET: z.string().min(32),
  // AES-256-GCM key material for TOTP secrets at rest (SHA-256 derived to 32 bytes).
  PLATFORM_TOTP_ENC_KEY: z.string().min(32),

  // Admin web app origin. The admin cookie is SameSite=Strict by default and
  // CORS never allows the tenant web app origin (PLATFORM-ADMIN-SPEC 2.4).
  WEB_APP_URL: z.string().default("http://localhost:5174"),
  COOKIE_SAMESITE: z.enum(["strict", "lax", "none"]).default("strict"),
  CORS_ORIGINS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    ),
})

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
    APP_NAME: "avuny-platform-api",
    APP_VERSION: "0.1.0",
    API_BASE_PATH: "/api",
  }

  Object.freeze(config.CORS_ORIGINS)

  return Object.freeze(config)
}

export type AppConfig = ReturnType<typeof loadConfig>

let cached: AppConfig | undefined
export const getConfig = (env: unknown = process.env) => (cached ??= loadConfig(env))

export const config = new Proxy({} as AppConfig, {
  get: (_, key) => getConfig()[key as keyof AppConfig],
})
