import { relations } from "drizzle-orm"
import {
    parties,
    partyAddresses,
    partyEmails,
    partyPhones,
    partyRoles,
} from "./parties.js"

export const partiesRelations = relations(parties, ({ many }) => ({
    roles: many(partyRoles),
    emails: many(partyEmails),
    phones: many(partyPhones),
    addresses: many(partyAddresses),
}))

export const partyRolesRelations = relations(partyRoles, ({ one }) => ({
    party: one(parties, {
        fields: [partyRoles.orgId, partyRoles.partyId],
        references: [parties.orgId, parties.id],
    }),
}))

export const partyEmailsRelations = relations(partyEmails, ({ one }) => ({
    party: one(parties, {
        fields: [partyEmails.orgId, partyEmails.partyId],
        references: [parties.orgId, parties.id],
    }),
}))

export const partyPhonesRelations = relations(partyPhones, ({ one }) => ({
    party: one(parties, {
        fields: [partyPhones.orgId, partyPhones.partyId],
        references: [parties.orgId, parties.id],
    }),
}))

export const partyAddressesRelations = relations(partyAddresses, ({ one }) => ({
    party: one(parties, {
        fields: [partyAddresses.orgId, partyAddresses.partyId],
        references: [parties.orgId, parties.id],
    }),
}))
