import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))

export const WEB_ROOT = resolve(here, "../..")
export const REPO_ROOT = resolve(WEB_ROOT, "../..")

/** Ports differ from `pnpm dev` (4000 / 5173) so an e2e run never collides with your dev servers. */
export const API_PORT = 4100
export const WEB_PORT = 5174
export const API_URL = `http://localhost:${API_PORT}`
export const WEB_URL = `http://localhost:${WEB_PORT}`

/** Every message the API "sends" is appended here as JSON lines (CaptureMessageSender). */
export const OUTBOX_FILE = resolve(WEB_ROOT, ".e2e/outbox.jsonl")

export const SERVER_PACKAGE = "@avuny/books-server"
