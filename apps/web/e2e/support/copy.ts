import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { REPO_ROOT } from "./env.ts"

type Json = { [key: string]: Json | string }

/**
 * English UI copy straight from the contracts locale files, so specs never hard-code strings:
 * `const t = copy("user"); t("auth.signIn.submitLabel")`. A renamed key fails loudly by name.
 */
export function copy(namespace: string): (key: string) => string {
  const file = resolve(
    REPO_ROOT,
    `packages/contracts/src/${namespace}/locales/en.json`
  )
  const json = JSON.parse(readFileSync(file, "utf8")) as Json
  return (key) => {
    let node: Json | string | undefined = json
    for (const part of key.split(".")) {
      node = typeof node === "object" ? node[part] : undefined
    }
    if (typeof node !== "string")
      throw new Error(`Missing "${namespace}" copy key: ${key}`)
    return node
  }
}
