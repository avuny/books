import { relations } from "drizzle-orm"
import { organizations } from "../organization/organizations.js"
import { accountMappings, accounts } from "./accounts.js"
import { journalEntries, journalEntryLines } from "./journal-entries.js"
import { accountingPeriods } from "./periods.js"

export const accountsRelations = relations(accounts, ({ one, many }) => ({
    organization: one(organizations, {
        fields: [accounts.orgId],
        references: [organizations.id],
    }),
    parent: one(accounts, {
        fields: [accounts.parentId],
        references: [accounts.id],
        relationName: "account_tree",
    }),
    children: many(accounts, { relationName: "account_tree" }),
    mappings: many(accountMappings),
    journalLines: many(journalEntryLines),
}))

export const accountMappingsRelations = relations(accountMappings, ({ one }) => ({
    organization: one(organizations, {
        fields: [accountMappings.orgId],
        references: [organizations.id],
    }),
    account: one(accounts, {
        fields: [accountMappings.accountId],
        references: [accounts.id],
    }),
}))

export const journalEntriesRelations = relations(journalEntries, ({ one, many }) => ({
    organization: one(organizations, {
        fields: [journalEntries.orgId],
        references: [organizations.id],
    }),
    reversalOf: one(journalEntries, {
        fields: [journalEntries.reversalOfId],
        references: [journalEntries.id],
        relationName: "journal_entry_reversal",
    }),
    reversedBy: many(journalEntries, { relationName: "journal_entry_reversal" }),
    lines: many(journalEntryLines),
}))

export const journalEntryLinesRelations = relations(journalEntryLines, ({ one }) => ({
    entry: one(journalEntries, {
        fields: [journalEntryLines.journalEntryId],
        references: [journalEntries.id],
    }),
    account: one(accounts, {
        fields: [journalEntryLines.accountId],
        references: [accounts.id],
    }),
}))

export const accountingPeriodsRelations = relations(accountingPeriods, ({ one }) => ({
    organization: one(organizations, {
        fields: [accountingPeriods.orgId],
        references: [organizations.id],
    }),
}))
