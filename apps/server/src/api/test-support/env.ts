import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { config as loadDotenv } from "dotenv"

/** apps/server */
export const SERVER_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../.."
)
/** packages/db/drizzle: the generated SQL migrations */
export const MIGRATIONS_DIR = resolve(SERVER_ROOT, "../../packages/db/drizzle")

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
 * that is not obviously a dedicated test database.
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
 * Makes this process an integration/e2e process. Call it before anything imports `config`.
 *  - reads `.env.test` (optional overrides), then fills every missing variable from the committed
 *    `.env.test.example` (test-only secrets, local compose database), so a fresh clone or CI
 *    needs no file. Precedence: shell/CI > .env.test > .env.test.example. Never reads `.env`.
 *  - points the app at the test database and nothing else, after the safety check;
 *  - switches external boundaries to test adapters (captured messages, inline background work).
 * Idempotent.
 */
export function loadTestEnv(): void {
  if (loaded) return

  const envFile = process.env.TEST_ENV_FILE ?? resolve(SERVER_ROOT, ".env.test")
  // src/api/config.ts does `import "dotenv/config"`, which reads DOTENV_CONFIG_PATH. Pointing it
  // at the test file keeps the developer's `.env` (real database, real keys) out of the process.
  process.env.DOTENV_CONFIG_PATH = envFile
  process.env.DOTENV_CONFIG_QUIET = "true"
  // dotenv never overrides a variable that is already set.
  loadDotenv({ path: envFile, quiet: true })
  loadDotenv({ path: resolve(SERVER_ROOT, ".env.test.example"), quiet: true })

  const url = process.env.TEST_DATABASE_URL
  if (!url)
    throw new Error(
      "TEST_DATABASE_URL is not set (see apps/server/.env.test.example)."
    )
  assertSafeTestDatabase(url)

  Object.assign(process.env, {
    NODE_ENV: "test",
    DATABASE_URL: url, // the app only ever sees the test database, whatever .env says
    MESSAGE_SENDER_MODE: "capture", // OTPs/invitations are captured, never sent
    BACKGROUND_RUNNER: "inline",
  })
  // Keep the suite fast without turning any protection off (override in .env.test if needed).
  process.env.BCRYPT_ROUNDS ??= "4"
  process.env.OTP_RESEND_COOLDOWN ??= "1s"
  loaded = true
}
