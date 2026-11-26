import type {
  MessageSender,
  SendInvitationInput,
  SendOtpMessageInput,
  SendSecurityNoticeInput,
} from "./messaging.service.js"

/** One message the app tried to deliver, exactly as a provider would have received it. */
export type CapturedMessage =
  | ({ kind: "otp"; at: string } & SendOtpMessageInput)
  | ({ kind: "security-notice"; at: string } & SendSecurityNoticeInput)
  | ({ kind: "invitation"; at: string } & Omit<
      SendInvitationInput,
      "expiresAt"
    > & {
        expiresAt: string
      })

/**
 * TEST-ONLY sender (MESSAGE_SENDER_MODE=capture). Nothing leaves the process; the message is
 * kept in memory so an in-process integration test can read the OTP the real flow produced.
 *
 * Out-of-process suites (the Playwright e2e run starts the API as a separate server) set
 * MESSAGE_OUTBOX_FILE: every message is also appended there as one JSON object per line.
 *
 * `getMessageSender()` refuses this mode when NODE_ENV=production.
 */
export class CaptureMessageSender implements MessageSender {
  private readonly messages: CapturedMessage[] = []

  constructor(private readonly outboxFile = process.env.MESSAGE_OUTBOX_FILE) {}

  async sendOtp(input: SendOtpMessageInput): Promise<void> {
    await this.record({ kind: "otp", at: new Date().toISOString(), ...input })
  }

  async sendSecurityNotice(input: SendSecurityNoticeInput): Promise<void> {
    await this.record({
      kind: "security-notice",
      at: new Date().toISOString(),
      ...input,
    })
  }

  async sendInvitation(input: SendInvitationInput): Promise<void> {
    await this.record({
      kind: "invitation",
      at: new Date().toISOString(),
      ...input,
      expiresAt: input.expiresAt.toISOString(),
    })
  }

  /** Every captured message, oldest first. */
  all(): readonly CapturedMessage[] {
    return this.messages
  }

  /** Latest OTP code sent to `identifier`; throws with a useful message if none was sent. */
  lastOtp(identifier: string): string {
    const to = identifier.trim().toLowerCase()
    const otp = this.messages
      .filter((m) => m.kind === "otp" && m.to.toLowerCase() === to)
      .at(-1)
    if (!otp || otp.kind !== "otp") {
      throw new Error(
        `No OTP was delivered to "${identifier}". Captured so far: ${
          this.messages.map((m) => `${m.kind}→${m.to}`).join(", ") || "nothing"
        }`
      )
    }
    return otp.code
  }

  /** Latest invitation sent to `identifier`, with the token parsed out of its link. */
  lastInvitation(identifier: string): { link: string; token: string } {
    const to = identifier.trim().toLowerCase()
    const invitation = this.messages
      .filter((m) => m.kind === "invitation" && m.to.toLowerCase() === to)
      .at(-1)
    if (!invitation || invitation.kind !== "invitation") {
      throw new Error(`No invitation was delivered to "${identifier}"`)
    }
    const token = new URL(invitation.link).searchParams.get("token")
    if (!token)
      throw new Error(`Invitation link has no token: ${invitation.link}`)
    return { link: invitation.link, token }
  }

  clear(): void {
    this.messages.length = 0
  }

  private async record(message: CapturedMessage): Promise<void> {
    this.messages.push(message)
    if (!this.outboxFile) return
    // Dynamic import keeps the Worker bundle free of node:fs unless the file sink is used.
    const { appendFile, mkdir } = await import("node:fs/promises")
    const { dirname } = await import("node:path")
    await mkdir(dirname(this.outboxFile), { recursive: true })
    await appendFile(this.outboxFile, `${JSON.stringify(message)}\n`)
  }
}
