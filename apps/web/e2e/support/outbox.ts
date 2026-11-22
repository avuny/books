import { readFile } from "node:fs/promises"
import { OUTBOX_FILE } from "./env.ts"

interface OutboxMessage {
  kind: string
  to: string
  code?: string
  link?: string
}

async function readOutbox(): Promise<OutboxMessage[]> {
  const text = await readFile(OUTBOX_FILE, "utf8").catch(() => "")
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as OutboxMessage)
}

async function waitFor<T>(
  find: (messages: OutboxMessage[]) => T | undefined,
  describe: string,
  timeoutMs = 10_000
): Promise<T> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const found = find(await readOutbox())
    if (found !== undefined) return found
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${describe}`)
}

/** The latest OTP the API sent to `identifier` (a real sign-up/sign-in flow produced it). */
export function waitForOtp(identifier: string): Promise<string> {
  const to = identifier.toLowerCase()
  return waitFor(
    (messages) =>
      messages
        .filter((m) => m.kind === "otp" && m.to.toLowerCase() === to)
        .at(-1)?.code,
    `an OTP for ${identifier}`
  )
}

/** The latest invitation link the API sent to `identifier`. */
export function waitForInvitationLink(identifier: string): Promise<string> {
  const to = identifier.toLowerCase()
  return waitFor(
    (messages) =>
      messages
        .filter((m) => m.kind === "invitation" && m.to.toLowerCase() === to)
        .at(-1)?.link,
    `an invitation for ${identifier}`
  )
}
