// Replace the user-module relation blocks in packages/db relations.ts with the blocks below and keep
// every other relation in that file. Adjust the import paths to your file names.
import { relations } from "drizzle-orm"
import { auditEvents } from "./audit-events.js"
import { otps } from "./otps.js"
import { sessions } from "./sessions.js"
import { userIdentifiers } from "./user-identifiers.js"
import { users } from "./users.js"

export const usersRelations = relations(users, ({ many }) => ({
  identifiers: many(userIdentifiers),
  sessions: many(sessions),
}))

export const userIdentifiersRelations = relations(
  userIdentifiers,
  ({ one }) => ({
    user: one(users, {
      fields: [userIdentifiers.userId],
      references: [users.id],
    }),
  })
)

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}))

export const otpsRelations = relations(otps, ({ one }) => ({
  user: one(users, {
    fields: [otps.userId],
    references: [users.id],
  }),
}))

// audit_events has no foreign keys (rows outlive users); these relations exist only for admin joins.
export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  actor: one(users, {
    fields: [auditEvents.actorUserId],
    references: [users.id],
  }),
  subject: one(users, {
    fields: [auditEvents.subjectUserId],
    references: [users.id],
  }),
}))
