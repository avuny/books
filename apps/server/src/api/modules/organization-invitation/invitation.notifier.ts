import type { InvitationNotifier } from "./organization-invitation.service.js"
import { logger } from "@avuny/logger"

export interface MessageInvitationNotifierDeps {
  sender: {
    sendInvitation?(input: {
      to: string
      type: "email" | "phone"
      orgName: string
      link: string
      expiresAt: Date
    }): Promise<void>
  }
  /**
   * Builds the accept link from the plaintext token, e.g.
   * (t) => `${config.WEB_APP_URL}/invitations/accept?token=${encodeURIComponent(t)}`
   */
  buildLink: (token: string) => string
}

/** Invitation channel "whatsapp" maps to the message service's "phone" channel. */
export function createMessageInvitationNotifier({
  sender,
  buildLink,
}: MessageInvitationNotifierDeps): InvitationNotifier {
  return {
    async send({ invitation, org, token }) {
      if (!sender.sendInvitation) {
        logger.warn("[invitation.notifier] MessageSender does not implement sendInvitation — skipping")
        return
      }

      const base = {
        orgName: org.name,
        link: buildLink(token),
        expiresAt: invitation.expiresAt,
      }

      if (invitation.channel === "email") {
        if (!invitation.email) throw new Error("Invitation has no email address")
        return sender.sendInvitation({ ...base, to: invitation.email, type: "email" })
      }

      if (!invitation.phone) throw new Error("Invitation has no phone number")
      return sender.sendInvitation({ ...base, to: invitation.phone, type: "phone" })
    },
  }
}

