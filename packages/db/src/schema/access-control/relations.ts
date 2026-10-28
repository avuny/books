import { relations } from "drizzle-orm"
import { organizations, organizationUsers } from "../organization/organizations.js"
import { users } from "../user/users.js"
import { roles, rolePermissions, organizationUserRoles } from "./role.js"

export const rolesRelations = relations(roles, ({ one, many }) => ({
    organization: one(organizations, {
        fields: [roles.orgId],
        references: [organizations.id],
    }), // null = system role
    permissions: many(rolePermissions),
    assignments: many(organizationUserRoles),
}))

export const rolePermissionsRelations = relations(
    rolePermissions,
    ({ one }) => ({
        role: one(roles, {
            fields: [rolePermissions.roleId],
            references: [roles.id],
        }),
    })
)

export const organizationUserRolesRelations = relations(
    organizationUserRoles,
    ({ one }) => ({
        member: one(organizationUsers, {
            fields: [organizationUserRoles.orgUserId],
            references: [organizationUsers.id],
        }),
        role: one(roles, {
            fields: [organizationUserRoles.roleId],
            references: [roles.id],
        }),
        assignedBy: one(users, {
            fields: [organizationUserRoles.assignedByUserId],
            references: [users.id],
        }),
    })
)