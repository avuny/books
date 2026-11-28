// Fails when apps/server/wrangler.jsonc lacks a non-secret var the API needs in production.
// `wrangler deploy` replaces dashboard-set plain variables with this block, so a missing key
// is wiped on the next deploy and breaks browser sign-in while server tests stay green.
// Secrets (DATABASE_URL, *_SECRET, API keys) must NOT be listed here.
import { readFileSync } from "node:fs"

const REQUIRED = ["ENVIRONMENT", "NODE_ENV", "COOKIE_SAMESITE", "WEB_APP_URL", "CORS_ORIGINS"]
const FORBIDDEN = ["DATABASE_URL", "ACCESS_TOKEN_SECRET", "VERIFICATION_TOKEN_SECRET", "OTP_SECRET", "AUDIT_HMAC_SECRET", "RESEND_API_KEY"]

const path = process.argv[2] ?? "apps/server/wrangler.jsonc"
// Strip // comments (not inside strings: this file has no "//" in values except URLs, so only
// remove comments that start a line or follow whitespace).
const text = readFileSync(path, "utf8").replace(/(^|\s)\/\/.*$/gm, "$1")
const vars = JSON.parse(text).vars ?? {}

const errors = []
for (const k of REQUIRED) if (!vars[k]) errors.push(`missing var ${k}`)
for (const k of FORBIDDEN) if (k in vars) errors.push(`${k} is a secret, remove it from vars`)
if (vars.NODE_ENV && vars.NODE_ENV !== "production") errors.push("NODE_ENV must be production")
if (vars.CORS_ORIGINS && vars.WEB_APP_URL && !vars.CORS_ORIGINS.split(",").map((s) => s.trim()).includes(vars.WEB_APP_URL))
  errors.push("CORS_ORIGINS must include WEB_APP_URL")

if (errors.length) {
  for (const e of errors) console.error(`::error::wrangler vars: ${e}`)
  process.exit(1)
}
console.log(`wrangler vars ok (${REQUIRED.join(", ")})`)
