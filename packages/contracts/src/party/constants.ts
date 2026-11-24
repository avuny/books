import type { ActivityLogAction } from "../activity-log/index.js"

export const PARTY_TYPES = ["PERSON", "ORGANIZATION"] as const
export type PartyType = (typeof PARTY_TYPES)[number]

export const PARTY_SALUTATIONS = [
  "MR",
  "MS",
  "MRS",
  "DR",
  "PROF",
  "OTHER",
] as const
export type PartySalutation = (typeof PARTY_SALUTATIONS)[number]

export const PARTY_ROLES = ["CUSTOMER", "VENDOR"] as const
export type PartyRole = (typeof PARTY_ROLES)[number]

export const PARTY_OPPOSITE_ROLE = {
  CUSTOMER: "VENDOR",
  VENDOR: "CUSTOMER",
} as const satisfies Record<PartyRole, PartyRole>

// Audit events
export const PARTY_AUDIT_EVENTS = {
  CUSTOMER_CREATED: "customer.created",
  CUSTOMER_UPDATED: "customer.updated",
  CUSTOMER_DEACTIVATED: "customer.deactivated",
  CUSTOMER_REACTIVATED: "customer.reactivated",
  VENDOR_CREATED: "vendor.created",
  VENDOR_UPDATED: "vendor.updated",
  VENDOR_DEACTIVATED: "vendor.deactivated",
  VENDOR_REACTIVATED: "vendor.reactivated",
} as const satisfies Record<string, ActivityLogAction>

// Limits that back database check constraints
export const PARTY_DISPLAY_NAME_MAX_LENGTH = 150 // ck_party_display_name_len
export const PARTY_LEGAL_NAME_MAX_LENGTH = 200 // ck_party_legal_name_len
export const PARTY_TAX_NUMBER_MAX_LENGTH = 50 // ck_party_tax_number_len
export const PARTY_WEBSITE_MAX_LENGTH = 255 // ck_party_website_len
export const PARTY_NOTES_MAX_LENGTH = 2000 // ck_party_notes_len
export const PARTY_EMAIL_MAX_LENGTH = 254 // ck_party_email_len
export const PARTY_PHONE_MIN_DIGITS = 3
export const PARTY_PHONE_MAX_LENGTH = 32 // ck_party_phone_len
export const PARTY_CONTACT_LABEL_MAX_LENGTH = 50 // ck_party_email_label_len, ck_party_phone_label_len, ck_party_address_label_len
export const PARTY_ADDRESS_LINE_MAX_LENGTH = 200 // ck_party_address_line1_len, ck_party_address_line2_len
export const PARTY_CITY_MAX_LENGTH = 100 // ck_party_address_city_len
export const PARTY_STATE_MAX_LENGTH = 100 // ck_party_address_state_len
export const PARTY_POSTAL_CODE_MAX_LENGTH = 20 // ck_party_address_postal_code_len
export const PARTY_COUNTRY_CODE_PATTERN = "^[A-Z]{2}$" // ck_party_address_country_code
export const PARTY_CONTACTS_MAX_COUNT = 10

// Query & pagination constants
export const PARTY_DEFAULT_PAGE = 1
export const PARTY_DEFAULT_PAGE_SIZE = 20
export const PARTY_MAX_PAGE_SIZE = 100
export const PARTY_SEARCH_MAX_LENGTH = 100
export const PARTY_OPTION_DEFAULT_LIMIT = 20
export const PARTY_OPTION_MAX_LIMIT = 50
