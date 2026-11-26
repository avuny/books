import { useTranslation } from "react-i18next"
import {
  PARTY_TYPES,
  PARTY_SALUTATIONS,
  type PartyRole,
} from "@avuny/contracts/party"
import type { PartyFormCopy } from "./party-form-types.js"
import { oppositeRole } from "../lib/party-roles.js"

export function usePartyFormCopy(
  mode: "create" | "update",
  role: PartyRole
): PartyFormCopy {
  const { t } = useTranslation("party")
  const opp = oppositeRole(role)

  return {
    title:
      mode === "create"
        ? t(`create.${role}.title`, {
            defaultValue: role === "CUSTOMER" ? "New Customer" : "New Vendor",
          })
        : t("update.title", { defaultValue: "Edit Party" }),
    description:
      mode === "create"
        ? t(`create.${role}.description`, {
            defaultValue: `Add a new ${role.toLowerCase()} to your organization.`,
          })
        : t("update.description", {
            defaultValue: "Update information for this party.",
          }),
    partyType: {
      label: t("fields.partyType.label", { defaultValue: "Party Type" }),
      options: PARTY_TYPES.map((value) => ({
        value,
        label: t(`labels.types.${value}`, { defaultValue: value }),
      })),
    },
    salutation: {
      label: t("fields.salutation.label", { defaultValue: "Salutation" }),
      placeholder: t("fields.salutation.placeholder", {
        defaultValue: "Select salutation",
      }),
      options: PARTY_SALUTATIONS.map((value) => ({
        value,
        label: t(`labels.salutations.${value}`, { defaultValue: value }),
      })),
    },
    displayName: {
      label: t("fields.displayName.label", { defaultValue: "Display Name" }),
      placeholder: t("fields.displayName.placeholder", {
        defaultValue: "e.g. Acme Corp or John Doe",
      }),
    },
    legalName: {
      label: t("fields.legalName.label", { defaultValue: "Legal Name" }),
      placeholder: t("fields.legalName.placeholder", {
        defaultValue: "Registered legal entity name",
      }),
    },
    taxNumber: {
      label: t("fields.taxNumber.label", { defaultValue: "Tax Number / VAT ID" }),
      placeholder: t("fields.taxNumber.placeholder", {
        defaultValue: "e.g. 123456789",
      }),
    },
    website: {
      label: t("fields.website.label", { defaultValue: "Website" }),
      placeholder: t("fields.website.placeholder", {
        defaultValue: "https://example.com",
      }),
    },
    notes: {
      label: t("fields.notes.label", { defaultValue: "Notes" }),
      placeholder: t("fields.notes.placeholder", {
        defaultValue: "Internal remarks or notes...",
      }),
    },
    alsoAddOpposite: {
      label: t(`create.alsoAdd.${opp}`, {
        defaultValue: opp === "CUSTOMER" ? "Also add as Customer" : "Also add as Vendor",
      }),
    },
    emails: {
      title: t("contacts.emails.title", { defaultValue: "Email Addresses" }),
      add: t("contacts.emails.add", { defaultValue: "Add email" }),
      remove: t("contacts.emails.remove", { defaultValue: "Remove email" }),
      primary: t("contacts.emails.primary", { defaultValue: "Primary" }),
      email: {
        label: t("fields.email.label", { defaultValue: "Email" }),
        placeholder: t("fields.email.placeholder", {
          defaultValue: "name@example.com",
        }),
      },
      label: {
        label: t("fields.label.label", { defaultValue: "Label" }),
        placeholder: t("fields.label.placeholder", {
          defaultValue: "e.g. Work, Billing",
        }),
      },
    },
    phones: {
      title: t("contacts.phones.title", { defaultValue: "Phone Numbers" }),
      add: t("contacts.phones.add", { defaultValue: "Add phone" }),
      remove: t("contacts.phones.remove", { defaultValue: "Remove phone" }),
      primary: t("contacts.phones.primary", { defaultValue: "Primary" }),
      phone: {
        label: t("fields.phone.label", { defaultValue: "Phone" }),
        placeholder: t("fields.phone.placeholder", {
          defaultValue: "+1 234 567 8900",
        }),
      },
      label: {
        label: t("fields.label.label", { defaultValue: "Label" }),
        placeholder: t("fields.label.placeholder", {
          defaultValue: "e.g. Mobile, Office",
        }),
      },
    },
    addresses: {
      title: t("contacts.addresses.title", { defaultValue: "Addresses" }),
      add: t("contacts.addresses.add", { defaultValue: "Add address" }),
      remove: t("contacts.addresses.remove", { defaultValue: "Remove address" }),
      primary: t("contacts.addresses.primary", { defaultValue: "Primary" }),
      label: {
        label: t("fields.label.label", { defaultValue: "Label" }),
        placeholder: t("fields.label.placeholder", {
          defaultValue: "e.g. Billing, Shipping, Head Office",
        }),
      },
      addressLine1: {
        label: t("fields.addressLine1.label", { defaultValue: "Address Line 1" }),
        placeholder: t("fields.addressLine1.placeholder", {
          defaultValue: "Street address, P.O. box",
        }),
      },
      addressLine2: {
        label: t("fields.addressLine2.label", { defaultValue: "Address Line 2" }),
        placeholder: t("fields.addressLine2.placeholder", {
          defaultValue: "Apartment, suite, unit",
        }),
      },
      city: {
        label: t("fields.city.label", { defaultValue: "City" }),
        placeholder: t("fields.city.placeholder", { defaultValue: "City" }),
      },
      state: {
        label: t("fields.state.label", { defaultValue: "State / Province" }),
        placeholder: t("fields.state.placeholder", {
          defaultValue: "State or province",
        }),
      },
      postalCode: {
        label: t("fields.postalCode.label", { defaultValue: "Postal Code" }),
        placeholder: t("fields.postalCode.placeholder", {
          defaultValue: "Postal code",
        }),
      },
      countryCode: {
        label: t("fields.countryCode.label", { defaultValue: "Country" }),
        placeholder: t("fields.countryCode.placeholder", {
          defaultValue: "e.g. US, EG",
        }),
      },
    },
    submitLabel:
      mode === "create"
        ? t("create.submitLabel", { defaultValue: "Save" })
        : t("update.submitLabel", { defaultValue: "Save changes" }),
    submittingLabel:
      mode === "create"
        ? t("create.submittingLabel", { defaultValue: "Saving..." })
        : t("update.submittingLabel", { defaultValue: "Saving..." }),
    cancelLabel: t("actions.cancel", { defaultValue: "Cancel" }),
  }
}
