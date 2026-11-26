// Provide dummy secrets for OpenAPI spec generation if env vars are not set
process.env.DATABASE_URL ??= "postgres://user:pass@localhost:5432/db"
process.env.ACCESS_TOKEN_SECRET ??= "0123456789abcdef0123456789abcdef"
process.env.VERIFICATION_TOKEN_SECRET ??= "0123456789abcdef0123456789abcdef"
process.env.OTP_SECRET ??= "0123456789abcdef0123456789abcdef"
process.env.AUDIT_HMAC_SECRET ??= "0123456789abcdef0123456789abcdef"

import { writeFileSync, mkdirSync } from "fs"
import { dirname } from "path"

const { app } = await import("../src/index.js")
const outputPath = "./openapi/openapi.json"

// make sure the directory exists
mkdirSync(dirname(outputPath), { recursive: true })

const spec = app.getOpenAPIDocument({
  openapi: "3.0.0",
  info: {
    title: "IMS API",
    version: "1.0.0",
  },
})

writeFileSync(outputPath, JSON.stringify(spec, null, 2), "utf-8")

console.log("OpenAPI spec generated at", outputPath)
