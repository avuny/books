#!/usr/bin/env node
// Usage: node check-locale-parity.mjs <locales-dir> [--errors <errors.ts>]
// Fails (exit 1) if en.json / ar.json differ in keys, or if an error code is missing a message.
import { readFileSync } from "node:fs"
import { join } from "node:path"

const args = process.argv.slice(2)
const dir = args[0]
if (!dir) {
  console.error("Usage: check-locale-parity.mjs <locales-dir> [--errors <errors.ts>]")
  process.exit(2)
}
const errIdx = args.indexOf("--errors")
const errorsFile = errIdx >= 0 ? args[errIdx + 1] : null

const flatten = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  )

const load = (lang) => JSON.parse(readFileSync(join(dir, `${lang}.json`), "utf8"))
const en = load("en")
const ar = load("ar")
const enKeys = new Set(flatten(en))
const arKeys = new Set(flatten(ar))

let failed = false
for (const k of enKeys) if (!arKeys.has(k)) { console.error(`missing in ar: ${k}`); failed = true }
for (const k of arKeys) if (!enKeys.has(k)) { console.error(`missing in en: ${k}`); failed = true }

if (errorsFile) {
  const src = readFileSync(errorsFile, "utf8")
  const codes = [...src.matchAll(/^\s*([A-Z][A-Z0-9_]+):/gm)].map((m) => m[1])
  for (const code of codes)
    for (const [lang, json] of [["en", en], ["ar", ar]])
      if (!json.errors || !(code in json.errors)) {
        console.error(`error code ${code} has no message in ${lang}.json`)
        failed = true
      }
}

console.log(failed ? "FAILED" : `OK (${enKeys.size} keys)`)
process.exit(failed ? 1 : 0)
