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
    PARTY_ADDRESS_LINE_MAX_LENGTH,
    PARTY_CITY_MAX_LENGTH,
    PARTY_CONTACT_LABEL_MAX_LENGTH,
    PARTY_COUNTRY_CODE_PATTERN,
    PARTY_DISPLAY_NAME_MAX_LENGTH,
    PARTY_EMAIL_MAX_LENGTH,
    PARTY_LEGAL_NAME_MAX_LENGTH,
    PARTY_NOTES_MAX_LENGTH,
    PARTY_PHONE_MAX_LENGTH,
    PARTY_POSTAL_CODE_MAX_LENGTH,
    PARTY_ROLES,
    PARTY_SALUTATIONS,
    PARTY_STATE_MAX_LENGTH,
    PARTY_TAX_NUMBER_MAX_LENGTH,
    PARTY_TYPES,
    PARTY_WEBSITE_MAX_LENGTH,
} from "@avuny/contracts/party"
import { lengthBetween, matchesRegex, pk, timestamps } from "../_helpers.js"
import { orgRef } from "../organization/organizations.js"

/* ---------- Postgres Enums ---------- */

export const partyTypeEnum = pgEnum("party_type", PARTY_TYPES)
export type PartyType = (typeof partyTypeEnum.enumValues)[number]

export const partySalutationEnum = pgEnum("party_salutation", PARTY_SALUTATIONS)
export type PartySalutation = (typeof partySalutationEnum.enumValues)[number]

export const partyRoleEnum = pgEnum("party_role", PARTY_ROLES)
export type PartyRole = (typeof partyRoleEnum.enumValues)[number]

/* ---------- Tables ---------- */

/**
 * PARTIES: shared identity of a person or organization interacting with the tenant.
 *
 * Flow: Created from the Customers or Vendors page (or API) together with at least one role;
 * edited from either role view; never hard-deleted in normal flows.
 *
 * Integrity:
 *  - ux_party_org_id (org_id, id) is the composite FK target for all owned child records
 *    and future transactional documents.
 *  - Display names are ordered case-insensitively with id tie-breaker.
 *  - Salutations are restricted to PERSON parties only.
 *
 * Not expressible here:
 *  - At least one role row at creation (service-enforced).
 *  - party_type immutability after creation.
 *  - Display names and tax numbers are deliberately not unique (no company-wide name lock).
 *  - No is_active column on parties by design: inactive roles remain for historical reference.
 */
export const parties = pgTable(
    "parties",
    {
        id: pk(),
        orgId: orgRef(),
        partyType: partyTypeEnum("party_type").notNull(),
        salutation: partySalutationEnum("salutation"),
        displayName: text("display_name").notNull(),
        legalName: text("legal_name"),
        taxNumber: text("tax_number"),
        website: text("website"),
        notes: text("notes"),
        ...timestamps(),
    },
    (t) => [
        unique("ux_party_org_id").on(t.orgId, t.id),
        index("ix_party_org_display_name").on(t.orgId, sql`lower(${t.displayName})`, t.id),
        check("ck_party_display_name_len", lengthBetween(t.displayName, 1, PARTY_DISPLAY_NAME_MAX_LENGTH)),
        check("ck_party_legal_name_len", lengthBetween(t.legalName, 1, PARTY_LEGAL_NAME_MAX_LENGTH)),
        check("ck_party_tax_number_len", lengthBetween(t.taxNumber, 1, PARTY_TAX_NUMBER_MAX_LENGTH)),
        check("ck_party_website_len", lengthBetween(t.website, 1, PARTY_WEBSITE_MAX_LENGTH)),
        check("ck_party_notes_len", lengthBetween(t.notes, 1, PARTY_NOTES_MAX_LENGTH)),
        check(
            "ck_party_salutation_person_only",
            sql`${t.salutation} IS NULL OR ${t.partyType} = 'PERSON'`
        ),
    ]
)
export type Party = typeof parties.$inferSelect
export type NewParty = typeof parties.$inferInsert

/**
 * PARTY_ROLES: Customer and Vendor business role assignments of a party.
 *
 * Flow: One row per (party, role). Inserted at party creation or when the opposite
 * role is added. Toggled active/inactive by deactivate / reactivate.
 *
 * Integrity:
 *  - Composite FK to parties guarantees strict organization isolation.
 *  - Exactly one assignment per role per party (ux_party_role_party_role).
 *  - Covered index (org_id, role, is_active, party_id) powers filtered list/options.
 *
 * Not expressible here:
 *  - Who may toggle (permissions checked in service).
 *  - Active role requirement on transactional documents (checked by assertActiveRole).
 */
export const partyRoles = pgTable(
    "party_roles",
    {
        id: pk(),
        orgId: orgRef(),
        partyId: uuid("party_id").notNull(),
        role: partyRoleEnum("role").notNull(),
        isActive: boolean("is_active").notNull().default(true),
        ...timestamps(),
    },
    (t) => [
        unique("ux_party_role_party_role").on(t.orgId, t.partyId, t.role),
        foreignKey({
            name: "fk_party_role_party",
            columns: [t.orgId, t.partyId],
            foreignColumns: [parties.orgId, parties.id],
        }).onDelete("cascade"),
        index("ix_party_role_org_role_active").on(t.orgId, t.role, t.isActive, t.partyId),
    ]
)
export type PartyRoleAssignment = typeof partyRoles.$inferSelect
export type NewPartyRoleAssignment = typeof partyRoles.$inferInsert

/**
 * PARTY_EMAILS: email addresses owned by the party.
 *
 * Flow: Managed as part of the party aggregate; replaced as a collection on update.
 *
 * Integrity:
 *  - Composite FK to parties on (org_id, party_id).
 *  - Unique case-insensitive email per party (ux_party_email_party_email).
 *  - At most one primary email per party enforced by partial unique index (ux_party_email_primary).
 *
 * Not expressible here:
 *  - Exactly one primary when collection is non-empty (enforced by service & rules).
 *  - Maximum 10 entries per collection (enforced by Zod & service rules).
 */
export const partyEmails = pgTable(
    "party_emails",
    {
        id: pk(),
        orgId: orgRef(),
        partyId: uuid("party_id").notNull(),
        email: text("email").notNull(),
        label: text("label"),
        isPrimary: boolean("is_primary").notNull().default(false),
        ...timestamps(),
    },
    (t) => [
        foreignKey({
            name: "fk_party_email_party",
            columns: [t.orgId, t.partyId],
            foreignColumns: [parties.orgId, parties.id],
        }).onDelete("cascade"),
        uniqueIndex("ux_party_email_party_email").on(t.orgId, t.partyId, sql`lower(${t.email})`),
        uniqueIndex("ux_party_email_primary")
            .on(t.orgId, t.partyId)
            .where(sql`${t.isPrimary} = true`),
        check("ck_party_email_len", lengthBetween(t.email, 1, PARTY_EMAIL_MAX_LENGTH)),
        check("ck_party_email_label_len", lengthBetween(t.label, 1, PARTY_CONTACT_LABEL_MAX_LENGTH)),
    ]
)
export type PartyEmail = typeof partyEmails.$inferSelect
export type NewPartyEmail = typeof partyEmails.$inferInsert

/**
 * PARTY_PHONES: telephone numbers owned by the party.
 *
 * Flow: Managed as part of the party aggregate; replaced as a collection on update.
 *
 * Integrity:
 *  - Composite FK to parties on (org_id, party_id).
 *  - At most one primary phone per party enforced by partial unique index (ux_party_phone_primary).
 *
 * Not expressible here:
 *  - Exactly one primary when collection is non-empty (enforced by service & rules).
 *  - Maximum 10 entries per collection.
 *  - Phone number digit formatting and character validation (enforced by contracts).
 */
export const partyPhones = pgTable(
    "party_phones",
    {
        id: pk(),
        orgId: orgRef(),
        partyId: uuid("party_id").notNull(),
        phone: text("phone").notNull(),
        label: text("label"),
        isPrimary: boolean("is_primary").notNull().default(false),
        ...timestamps(),
    },
    (t) => [
        foreignKey({
            name: "fk_party_phone_party",
            columns: [t.orgId, t.partyId],
            foreignColumns: [parties.orgId, parties.id],
        }).onDelete("cascade"),
        index("ix_party_phone_party").on(t.orgId, t.partyId),
        uniqueIndex("ux_party_phone_primary")
            .on(t.orgId, t.partyId)
            .where(sql`${t.isPrimary} = true`),
        check("ck_party_phone_len", lengthBetween(t.phone, 1, PARTY_PHONE_MAX_LENGTH)),
        check("ck_party_phone_label_len", lengthBetween(t.label, 1, PARTY_CONTACT_LABEL_MAX_LENGTH)),
    ]
)
export type PartyPhone = typeof partyPhones.$inferSelect
export type NewPartyPhone = typeof partyPhones.$inferInsert

/**
 * PARTY_ADDRESSES: physical, billing or shipping addresses owned by the party.
 *
 * Flow: Managed as part of the party aggregate; replaced as a collection on update.
 *
 * Integrity:
 *  - Composite FK to parties on (org_id, party_id).
 *  - At most one primary address per party enforced by partial unique index (ux_party_address_primary).
 *  - ISO 3166-1 alpha-2 format check for country_code (ck_party_address_country_code).
 *
 * Not expressible here:
 *  - Exactly one primary when collection is non-empty (enforced by service & rules).
 *  - Maximum 10 entries per collection.
 *  - Country code existence in the countries catalog (format-only check in DB).
 */
export const partyAddresses = pgTable(
    "party_addresses",
    {
        id: pk(),
        orgId: orgRef(),
        partyId: uuid("party_id").notNull(),
        label: text("label"),
        addressLine1: text("address_line1").notNull(),
        addressLine2: text("address_line2"),
        city: text("city"),
        state: text("state"),
        postalCode: text("postal_code"),
        countryCode: text("country_code"),
        isPrimary: boolean("is_primary").notNull().default(false),
        ...timestamps(),
    },
    (t) => [
        foreignKey({
            name: "fk_party_address_party",
            columns: [t.orgId, t.partyId],
            foreignColumns: [parties.orgId, parties.id],
        }).onDelete("cascade"),
        index("ix_party_address_party").on(t.orgId, t.partyId),
        uniqueIndex("ux_party_address_primary")
            .on(t.orgId, t.partyId)
            .where(sql`${t.isPrimary} = true`),
        check("ck_party_address_label_len", lengthBetween(t.label, 1, PARTY_CONTACT_LABEL_MAX_LENGTH)),
        check("ck_party_address_line1_len", lengthBetween(t.addressLine1, 1, PARTY_ADDRESS_LINE_MAX_LENGTH)),
        check("ck_party_address_line2_len", lengthBetween(t.addressLine2, 1, PARTY_ADDRESS_LINE_MAX_LENGTH)),
        check("ck_party_address_city_len", lengthBetween(t.city, 1, PARTY_CITY_MAX_LENGTH)),
        check("ck_party_address_state_len", lengthBetween(t.state, 1, PARTY_STATE_MAX_LENGTH)),
        check("ck_party_address_postal_code_len", lengthBetween(t.postalCode, 1, PARTY_POSTAL_CODE_MAX_LENGTH)),
        check(
            "ck_party_address_country_code",
            sql`${t.countryCode} IS NULL OR ${matchesRegex(t.countryCode, PARTY_COUNTRY_CODE_PATTERN)}`
        ),
    ]
)
export type PartyAddress = typeof partyAddresses.$inferSelect
export type NewPartyAddress = typeof partyAddresses.$inferInsert
