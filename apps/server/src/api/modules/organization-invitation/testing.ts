// organization-invitation/testing.ts  (NEW)
// Test-only doubles, moved out of organization-invitation.service.ts.
import type {
  InvitationNotifier,
  UserDirectory,
} from "./organization-invitation.service.js"

export class DummyUserDirectory implements UserDirectory {
  async findVerifiedByContact(): Promise<null> {
    return null
  }
  async getVerifiedContacts(): Promise<null> {
    return null
  }
}

export class DummyInvitationNotifier implements InvitationNotifier {
  async send(): Promise<void> {}
}
