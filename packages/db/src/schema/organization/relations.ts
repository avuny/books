import { relations } from "drizzle-orm"
import { organizationUsers, organizations, organizationInvitations } from "./organizations.js"

import { users } from "../user/users.js"



/* organizations */

export const organizationsRelations = relations(
  organizations,
  ({ one, many }) => ({
    members: many(organizationUsers),
    invitations: many(organizationInvitations),
    // roles: many(roles),
    // billingAccount: one(billingAccounts),
    // subscriptions: many(subscriptions),
    // invoices: many(invoices),
    // payments: many(payments),
    // paymentMethods: many(paymentMethods),
  })
)

export const organizationUsersRelations = relations(
  organizationUsers,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [organizationUsers.orgId],
      references: [organizations.id],
    }),
    user: one(users, {
      fields: [organizationUsers.userId],
      references: [users.id],
    }),
    // roleAssignments: many(organizationUserRoles),
  })
)

export const organizationInvitationsRelations = relations(
  organizationInvitations,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationInvitations.orgId],
      references: [organizations.id],
    }),
    inviteeUser: one(users, {
      fields: [organizationInvitations.inviteeUserId],
      references: [users.id],
    }),
    inviter: one(organizationUsers, {
      fields: [organizationInvitations.invitedBy],
      references: [organizationUsers.id],
    }),
    acceptedMember: one(organizationUsers, {
      fields: [organizationInvitations.acceptedOrgUserId],
      references: [organizationUsers.id],
    }),
  })
)

