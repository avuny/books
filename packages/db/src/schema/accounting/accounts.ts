import { sql } from "drizzle-orm"
import {
    boolean,
    check,
    foreignKey,
    index,
    pgEnum,
    pgTable,
    text,
    unique,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core"
import {
    ACCOUNT_CODE_MAX_LENGTH,
    ACCOUNT_CODE_MIN_LENGTH,
    ACCOUNT_CODE_REGEX,
    ACCOUNT_DESCRIPTION_MAX_LENGTH,
    ACCOUNT_MAPPING_KEYS,
    ACCOUNT_NAME_MAX_LENGTH,
    ACCOUNT_NAME_MIN_LENGTH,
    ACCOUNT_NORMAL_BALANCES,
    ACCOUNT_SYSTEM_KEY_MAX_LENGTH,
    ACCOUNT_SYSTEM_KEY_REGEX,
    ACCOUNT_TYPES,
} from "@avuny/contracts/accounting"
import { lengthBetween, matchesRegex, pk, timestamps } from "../_helpers.js"
import { orgRef } from "../organization/organizations.js"

const sqlNum = (n: number) => sql.raw(String(n))

/* ---------- enums (owned by this file) ---------- */

export const accountTypeEnum = pgEnum("account_type", ACCOUNT_TYPES)
export const accountNormalBalanceEnum = pgEnum("account_normal_balance", ACCOUNT_NORMAL_BALANCES)
export const accountMappingKeyEnum = pgEnum("account_mapping_key", ACCOUNT_MAPPING_KEYS)

/**
 * ACCOUNTS: the chart of accounts of one organization, a tree of ledger accounts.
 * Flow: a new organization gets the default chart (contracts, DEFAULT_ACCOUNTS) in the same
 * transaction that creates it; accounts created by the organization sit next to the system ones.
 * Postings only ever reach accounts with allow_posting = true; parent accounts group and report.
 * Integrity: (org_id, id) is the FK target for the tree, the mappings and the journal lines; the
 * parent is an account of the same organization (composite self FK) and never the account itself;
 * a code is unique per organization ignoring case; a system key (the stable identity of a default
 * account, kept when the organization renames it) is unique per organization; the lengths and the
 * code and system key formats are checked from the shared contracts constants.
 * Not expressible here: that the parent has the same type and does not allow posting, that the tree
 * has no cycle, that a system account cannot be deleted or change type, that an account with journal
 * lines cannot be deleted or change type, and that a contra account carries the opposite normal
 * balance (all in the accounting service).
 */
export const accounts = pgTable(
    "accounts",
    {
        id: pk(),
        orgId: orgRef(),
        code: text("code").notNull(),
        name: text("name").notNull(),
        description: text("description"),
        type: accountTypeEnum("type").notNull(),
        normalBalance: accountNormalBalanceEnum("normal_balance").notNull(),
        parentId: uuid("parent_id"),
        systemKey: text("system_key"),
        isActive: boolean("is_active").notNull().default(true),
        allowPosting: boolean("allow_posting").notNull().default(true),
        ...timestamps(),
    },
    (t) => [
        unique("ux_account_org_id").on(t.orgId, t.id), // FK target for children, mappings, journal lines
        foreignKey({
            name: "fk_account_parent",
            columns: [t.orgId, t.parentId],
            foreignColumns: [t.orgId, t.id],
        }).onDelete("restrict"),
        uniqueIndex("ux_account_org_code").on(t.orgId, sql`lower(${t.code})`),
        uniqueIndex("ux_account_org_system_key")
            .on(t.orgId, t.systemKey)
            .where(sql`${t.systemKey} is not null`),
        index("ix_account_org_parent").on(t.orgId, t.parentId),
        index("ix_account_org_type").on(t.orgId, t.type),
        check("ck_account_code_len", lengthBetween(t.code, ACCOUNT_CODE_MIN_LENGTH, ACCOUNT_CODE_MAX_LENGTH)),
        check("ck_account_code_fmt", matchesRegex(t.code, ACCOUNT_CODE_REGEX.source)),
        check("ck_account_name_len", lengthBetween(t.name, ACCOUNT_NAME_MIN_LENGTH, ACCOUNT_NAME_MAX_LENGTH)),
        check(
            "ck_account_description_len",
            sql`${t.description} is null or char_length(${t.description}) <= ${sqlNum(ACCOUNT_DESCRIPTION_MAX_LENGTH)}`
        ),
        check(
            "ck_account_system_key_fmt",
            sql`${t.systemKey} is null or (${lengthBetween(t.systemKey, 1, ACCOUNT_SYSTEM_KEY_MAX_LENGTH)} and ${matchesRegex(t.systemKey, ACCOUNT_SYSTEM_KEY_REGEX.source)})`
        ),
        check("ck_account_parent_not_self", sql`${t.parentId} is null or ${t.parentId} <> ${t.id}`),
    ]
)
export type Account = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert

/**
 * ACCOUNT_MAPPINGS: which account plays each posting role (cash, accounts receivable, inventory,
 * cost of goods sold, ...) for one organization.
 * Flow: filled with the defaults when the organization is created; an administrator can point a role
 * at another account. Business modules never name an account: they name the role, and the posting
 * resolves it here.
 * Integrity: one row per (organization, role); the account belongs to the same organization
 * (composite FK, restrict, so a mapped account cannot be deleted).
 * Not expressible here: that the account allows posting, is active and has a type the role accepts
 * (contracts, ACCOUNT_MAPPING_ALLOWED_TYPES): the service checks it on every change and again on
 * every posting.
 */
export const accountMappings = pgTable(
    "account_mappings",
    {
        id: pk(),
        orgId: orgRef(),
        mappingKey: accountMappingKeyEnum("mapping_key").notNull(),
        accountId: uuid("account_id").notNull(),
        ...timestamps(),
    },
    (t) => [
        uniqueIndex("ux_account_mapping_org_key").on(t.orgId, t.mappingKey),
        foreignKey({
            name: "fk_account_mapping_account",
            columns: [t.orgId, t.accountId],
            foreignColumns: [accounts.orgId, accounts.id],
        }).onDelete("restrict"),
        index("ix_account_mapping_account").on(t.orgId, t.accountId),
    ]
)
export type AccountMapping = typeof accountMappings.$inferSelect
export type NewAccountMapping = typeof accountMappings.$inferInsert
