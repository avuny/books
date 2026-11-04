import type { InvitationNotifier } from "./organization-invitation.types.js"
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

      const isPhone = invitation.identifier.startsWith("+")
      const type: "email" | "phone" = isPhone ? "phone" : "email"
      return sender.sendInvitation({ ...base, to: invitation.identifier, type })
    },
  }
}
