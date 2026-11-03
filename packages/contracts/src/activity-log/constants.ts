export const ACTIVITY_LOG_RESOURCES = [
  "organization",
  "organization_user",
  "organization_invitation",
  "role",
] as const

export type ActivityLogResource = (typeof ACTIVITY_LOG_RESOURCES)[number]

export const ActivityLogResource = {
  ORGANIZATION: "organization",
  ORGANIZATION_USER: "organization_user",
  ORGANIZATION_INVITATION: "organization_invitation",
  ROLE: "role",
} as const

export const ACTIVITY_LOG_ACTIONS = [
  // organization
  "organization.created",
  "organization.updated",
  "organization.deleted",
  "organization.ownership_transferred",

  // organization_user
  "organization_user.joined",
  "organization_user.username_changed",
  "organization_user.deactivated",
  "organization_user.reactivated",
  "organization_user.roles_changed",

  // organization_invitation
  "organization_invitation.created",
  "organization_invitation.resent",
  "organization_invitation.revoked",
  "organization_invitation.accepted",
  "organization_invitation.declined",

  // role
  "role.created",
  "role.updated",
  "role.deleted",
] as const

export type ActivityLogAction = (typeof ACTIVITY_LOG_ACTIONS)[number]

export const ActivityLogAction = {
  ORGANIZATION_CREATED: "organization.created",
  ORGANIZATION_UPDATED: "organization.updated",
  ORGANIZATION_DELETED: "organization.deleted",
  ORGANIZATION_OWNERSHIP_TRANSFERRED: "organization.ownership_transferred",

  ORGANIZATION_USER_JOINED: "organization_user.joined",
  ORGANIZATION_USER_USERNAME_CHANGED: "organization_user.username_changed",
  ORGANIZATION_USER_DEACTIVATED: "organization_user.deactivated",
  ORGANIZATION_USER_REACTIVATED: "organization_user.reactivated",
  ORGANIZATION_USER_ROLES_CHANGED: "organization_user.roles_changed",

  ORGANIZATION_INVITATION_CREATED: "organization_invitation.created",
  ORGANIZATION_INVITATION_RESENT: "organization_invitation.resent",
  ORGANIZATION_INVITATION_REVOKED: "organization_invitation.revoked",
  ORGANIZATION_INVITATION_ACCEPTED: "organization_invitation.accepted",
  ORGANIZATION_INVITATION_DECLINED: "organization_invitation.declined",

  ROLE_CREATED: "role.created",
  ROLE_UPDATED: "role.updated",
  ROLE_DELETED: "role.deleted",
} as const

export const ACTIVITY_LOG_DEFAULT_PAGE_SIZE = 20
export const ACTIVITY_LOG_MAX_PAGE_SIZE = 100
