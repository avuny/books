import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { config as loadDotenv } from "dotenv"

/** apps/platform-server */
export const PLATFORM_SERVER_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../.."
)
/** packages/db/drizzle: the generated SQL migrations (shared with apps/server) */
export const MIGRATIONS_DIR = resolve(
  PLATFORM_SERVER_ROOT,
  "../../packages/db/drizzle"
)

const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
  "postgres", // docker-compose service name
  "db.localtest.me", // local Neon HTTP proxy
])

/**
 * The suite drops and recreates the `public` schema, so it must never run against anything
 * that is not obviously a dedicated test database. Same rule as apps/server.
 */
export function assertSafeTestDatabase(connectionString: string): void {
  let url: URL
  try {
    url = new URL(connectionString)
  } catch {
    throw new Error("TEST_DATABASE_URL is not a valid URL")
  }
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ""))
  if (!/(^|[_-])(test|e2e)($|[_-])/i.test(dbName)) {
    throw new Error(
      `Refusing to reset database "${dbName}": the name must contain "test" or "e2e" (for example avuny_test).`
    )
  }
  if (
    !LOCAL_HOSTS.has(url.hostname) &&
    process.env.TEST_DB_ALLOW_REMOTE !== "1"
  ) {
    throw new Error(
      `TEST_DATABASE_URL points at remote host "${url.hostname}". Set TEST_DB_ALLOW_REMOTE=1 only for a dedicated test database or Neon test branch.`
    )
  }
}

let loaded = false

/**
 * Makes this process an integration-test process. Simpler than apps/server's version:
 * no .env.test.example yet (the platform app has no test secrets so far). Precedence:
 * shell/CI > .env.test > the local compose default. Never reads `.env`.
 * Idempotent.
 */
export function loadTestEnv(): void {
  if (loaded) return

  const envFile = process.env.TEST_ENV_FILE ?? resolve(PLATFORM_SERVER_ROOT, ".env.test")
  process.env.DOTENV_CONFIG_PATH = envFile
  process.env.DOTENV_CONFIG_QUIET = "true"
  // dotenv never overrides a variable that is already set.
  loadDotenv({ path: envFile, quiet: true })

  // Default: the throw-away database from apps/server/docker-compose.test.yml.
  process.env.TEST_DATABASE_URL ??=
    "postgres://postgres:postgres@db.localtest.me:5432/avuny_test"

  const url = process.env.TEST_DATABASE_URL
  assertSafeTestDatabase(url)

  Object.assign(process.env, {
    NODE_ENV: "test",
    DATABASE_URL: url, // the app only ever sees the test database, whatever .env says
  })
  // Keep the suite fast without turning any protection off (override in .env.test if needed).
  process.env.BCRYPT_ROUNDS ??= "4"
  // Auth secrets for the test run only (A1-04). Fixed values keep tests deterministic;
  // production values come from wrangler secrets, never from the repo.
  process.env.PLATFORM_AUTH_TICKET_SECRET ??=
    "test-ticket-secret-0123456789abcdef0123456789abcdef"
  process.env.PLATFORM_TOTP_ENC_KEY ??=
    "test-totp-enc-key-0123456789abcdef0123456789abcdef"
  loaded = true
}
