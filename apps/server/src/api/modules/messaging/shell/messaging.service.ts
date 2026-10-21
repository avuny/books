import { logger } from "@avuny/logger"
import { Resend } from "resend"
import { config } from "../../../config.js"
/* -------------------------------------------------------------------------- */
/*                                  Contracts                                 */
/* -------------------------------------------------------------------------- */

export interface SendOtpMessageInput {
  to: string
  type: "email" | "phone"
  code: string
  purpose: string
  lang?: string
}

export interface SendSecurityNoticeInput {
  to: string
  type: "email" | "phone"
  event: string
  lang?: string
}

export interface MessageSender {
  sendOtp(input: SendOtpMessageInput): Promise<void>
  sendSecurityNotice?(input: SendSecurityNoticeInput): Promise<void>
}

type Channel = SendOtpMessageInput["type"]

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

async function assertOk(res: Response, provider: string): Promise<void> {
  if (res.ok) return
  const body = await res.text().catch(() => "")
  throw new Error(`${provider} request failed (${res.status}): ${body}`)
}

/* -------------------------------------------------------------------------- */
/*                         Strategy: Console (dev only)                       */
/* -------------------------------------------------------------------------- */

export class ConsoleMessageSender implements MessageSender {
  async sendOtp(input: SendOtpMessageInput): Promise<void> {
    logger.info(
      {
        to: input.to,
        type: input.type,
        code: input.code,
        purpose: input.purpose,
      },
      `[DEV OTP SENDER] Code for ${input.to} (${input.purpose}): ${input.code}`
    )
  }

  async sendSecurityNotice(input: SendSecurityNoticeInput): Promise<void> {
    logger.info(
      { to: input.to, type: input.type, event: input.event },
      `[DEV SECURITY NOTICE] Security notice for ${input.to}: ${input.event}`
    )
  }
}

/* -------------------------------------------------------------------------- */
/*                          Strategy: Email (Resend)                          */
/* -------------------------------------------------------------------------- */

interface ResendConfig {
  apiKey: string
  from: string
}

export class ResendEmailSender implements MessageSender {
  private readonly resend: Resend

  constructor(private readonly config: ResendConfig) {
    this.resend = new Resend(config.apiKey)
  }

  async sendOtp({ to, code, purpose }: SendOtpMessageInput): Promise<void> {
    console.log("resend is called!!!!!!!!!!!!!!")
    await this.send({
      to,
      subject: "Your verification code",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <p>Use this code to complete your <b>${escapeHtml(purpose)}</b>:</p>
          <p style="font-size:32px;letter-spacing:6px;font-weight:700">${escapeHtml(code)}</p>
          <p style="color:#666">If you didn't request this, you can ignore this email.</p>
        </div>`,
    })
  }

  async sendSecurityNotice({
    to,
    event,
  }: SendSecurityNoticeInput): Promise<void> {
    await this.send({
      to,
      subject: "Security notice",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <p>${escapeHtml(event)}</p>
          <p style="color:#666">If this wasn't you, please secure your account immediately.</p>
        </div>`,
    })
  }

  private async send(msg: {
    to: string
    subject: string
    html: string
  }): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.config.from,
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
    })

    if (error) {
      throw new Error(`Resend email failed: ${error.message}`)
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                 Strategy: Phone (WhatsApp Cloud API / Graph)               */
/* -------------------------------------------------------------------------- */

interface WhatsAppConfig {
  accessToken: string
  phoneNumberId: string
  otpTemplateName: string
  apiVersion: string
  defaultLang: string
}

export class WhatsAppMessageSender implements MessageSender {
  constructor(private readonly config: WhatsAppConfig) {}

  async sendOtp({ to, code, lang }: SendOtpMessageInput): Promise<void> {
    const {
      accessToken,
      phoneNumberId,
      otpTemplateName,
      apiVersion,
      defaultLang,
    } = this.config

    const res = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          // WhatsApp expects international format with digits only (no "+")
          to: to.replace(/\D/g, ""),
          type: "template",
          template: {
            name: otpTemplateName,
            language: { code: lang ?? defaultLang },
            components: [
              // Body: {{1}} = code
              { type: "body", parameters: [{ type: "text", text: code }] },
              // "Copy code" button of an Authentication template
              {
                type: "button",
                sub_type: "url",
                index: "0",
                parameters: [{ type: "text", text: code }],
              },
            ],
          },
        }),
      }
    )
    await assertOk(res, "WhatsApp")
  }
  // No sendSecurityNotice: it needs its own approved template.
}

/* -------------------------------------------------------------------------- */
/*              Context: picks the strategy by channel ("type")               */
/* -------------------------------------------------------------------------- */

export class ChannelMessageSender implements MessageSender {
  constructor(private readonly strategies: Record<Channel, MessageSender>) {}

  async sendOtp(input: SendOtpMessageInput): Promise<void> {
    await this.strategies[input.type].sendOtp(input)
    logger.info({ type: input.type, purpose: input.purpose }, "OTP sent")
  }

  async sendSecurityNotice(input: SendSecurityNoticeInput): Promise<void> {
    const strategy = this.strategies[input.type]
    if (!strategy.sendSecurityNotice) {
      logger.debug(
        { type: input.type },
        "Security notice not supported for channel"
      )
      return
    }
    await strategy.sendSecurityNotice(input)
  }
}

/* -------------------------------------------------------------------------- */
/*                                   Factory                                  */
/* -------------------------------------------------------------------------- */

let instance: MessageSender | undefined

/**
 * Resolves the message sender.
 * - MESSAGE_SENDER_MODE=console | live (optional)
 * - Default: "live" in production, "console" everywhere else.
 */
export function getMessageSender(): MessageSender {
  console.log("getMessageSender called", instance)
  if (instance) return instance

  // const mode =
  //   process.env.MESSAGE_SENDER_MODE ??
  //   (process.env.NODE_ENV === "production" ? "live" : "console")

  // if (mode === "console") {
  //   return (instance = new ConsoleMessageSender())
  // }

  return (instance = new ChannelMessageSender({
    email: new ResendEmailSender({
      apiKey: config.RESEND_API_KEY,
      from: config.EMAIL_FROM,
    }),
    // TODO
    phone: new WhatsAppMessageSender({
      accessToken: config.WHATSAPP_API_TOKEN || "",
      phoneNumberId: config.WHATSAPP_PHONE_NUMBER_ID || "",
      otpTemplateName: config.WHATSAPP_OTP_TEMPLATE_NAME || "",
      apiVersion: config.WHATSAPP_API_VERSION ?? "v23.0",
      defaultLang: config.WHATSAPP_DEFAULT_LANG ?? "en",
    }),
  }))
}
