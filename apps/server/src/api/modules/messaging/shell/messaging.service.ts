import { logger } from "@avuny/logger"

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

/**
 * Console message sender for development and testing.
 * Prints the OTP code to logger (never used in production).
 */
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
      {
        to: input.to,
        type: input.type,
        event: input.event,
      },
      `[DEV SECURITY NOTICE] Security notice for ${input.to}: ${input.event}`
    )
  }
}

/**
 * Resolves the message sender based on environment.
 */
export function getMessageSender(): MessageSender {
  return new ConsoleMessageSender()
}
