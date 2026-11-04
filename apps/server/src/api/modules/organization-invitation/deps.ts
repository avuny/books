import { db } from "../../db.js"
import { config } from "../../config.js"
import { getMessageSender } from "../messaging/index.js"
import { organizationUserService } from "../organization-user/index.js"
import { roleService, permissionChecker } from "../role/index.js"
import { DummyActivityLog } from "../activity-log/testing.js"
import { DummyLimits } from "../organization-user/organization-user.service.js"
import { createUserDirectory } from "./user-directory.adapter.js"
import { createMessageInvitationNotifier } from "./invitation.notifier.js"
import { createOrganizationInvitationRepository } from "./organization-invitation.repository.js"
import { createOrganizationInvitationService } from "./organization-invitation.service.js"
import type { OrganizationInvitationService } from "./organization-invitation.types.js"

let _serviceInstance: OrganizationInvitationService | undefined

export function getOrganizationInvitationService(): OrganizationInvitationService {
  if (!_serviceInstance) {
    const repo = createOrganizationInvitationRepository({ db })
    const notifier = createMessageInvitationNotifier({
      sender: getMessageSender(),
      buildLink: (token) =>
        `${config.WEB_APP_URL}/invitations/accept?token=${encodeURIComponent(token)}`,
    })

    _serviceInstance = createOrganizationInvitationService({
      repo,
      organizationUserService,
      roleService,
      permissions: permissionChecker,
      activityLog: new DummyActivityLog(),
      limits: new DummyLimits(),
      users: createUserDirectory(db),
      notifier,
    })
  }

  return _serviceInstance
}

export const organizationInvitationService = new Proxy({} as OrganizationInvitationService, {
  get(_target, prop) {
    return (getOrganizationInvitationService() as any)[prop]
  },
})
