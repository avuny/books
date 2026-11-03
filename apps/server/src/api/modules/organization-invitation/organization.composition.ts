// organization/organization.composition.ts  (NEW, replaces both createDefault… singletons)
import type { Database } from "@avuny/db"
import { MessageSender } from "../messaging/index.js"
import { createOrganizationUserRepository } from "../organization-user/organization-user.repository.js"
import { DummyLimits, createOrganizationUserService } from "../organization-user/organization-user.service.js"
import { DummyActivityLog } from "../activity-log/testing.js"
import { PermissionChecker } from "../role/permission-checker/permission-checker.query.js"
import { createMessageInvitationNotifier } from "./invitation.notifier.js"
import { createOrganizationInvitationRepository } from "./organization-invitation.repository.js"
import { createOrganizationInvitationService } from "./organization-invitation.service.js"
import { createUserDirectory } from "./user-directory.adapter.js"


export interface OrganizationModuleEnv {
  db: Database
  messageSender: MessageSender
  /** e.g. config.WEB_APP_URL */
  appUrl: string
}

export function createOrganizationModules({ db, messageSender, appUrl }: OrganizationModuleEnv) {
  // One instance each, shared by both services.
  const permissions = new PermissionChecker(db)
  const activityLog = new DummyActivityLog() // TODO: audit adapter
  const limits = new DummyLimits() // TODO: billing adapter

  // The invitation service reuses this repository so both share one lock + transaction.
  const memberRepository = createOrganizationUserRepository({ db })

  const organizationUserService = createOrganizationUserService({
    repository: memberRepository,
    permissions,
    activityLog,
    limits,
  })

  const organizationInvitationService = createOrganizationInvitationService({
    repository: createOrganizationInvitationRepository({ db }),
    members: memberRepository,
    permissions,
    activityLog,
    limits,
    users: createUserDirectory(db),
    notifier: createMessageInvitationNotifier({
      sender: messageSender,
      buildLink: (token) => `${appUrl}/invitations/accept?token=${encodeURIComponent(token)}`,
    }),
  })

  return { organizationUserService, organizationInvitationService }
}

/* ---- app entry (where `db` and config are available) ----
import { db } from "../../db.js"
import { config } from "../../config.js"
import { getMessageSender } from "../message/message.sender.js"

export const { organizationUserService, organizationInvitationService } =
  createOrganizationModules({
    db,
    messageSender: getMessageSender(),
    appUrl: config.WEB_APP_URL,
  })
*/
