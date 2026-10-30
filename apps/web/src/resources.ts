import {
  commonTranslationsEn,
  commonTranslationsAr,
} from "@avuny/contracts/common"
import { userTranslationsAr, userTranslationsEn } from "@avuny/contracts/user"
import {
  organizationTranslationsAr,
  organizationTranslationsEn,
} from "@avuny/contracts/organization"
import { roleTranslationsAr, roleTranslationsEn } from "@avuny/contracts"
import { organizationInvitationTranslationsAr, organizationInvitationTranslationsEn } from "@avuny/contracts/organization-invitation"

export const resources = {
  en: {
    common: commonTranslationsEn,
    user: userTranslationsEn,
    organization: organizationTranslationsEn,
    role: roleTranslationsEn,
    "organization-invitation": organizationInvitationTranslationsEn,
  },
  ar: {
    common: commonTranslationsAr,
    user: userTranslationsAr,
    organization: organizationTranslationsAr,
    role: roleTranslationsAr,
    "organization-invitation": organizationInvitationTranslationsAr,
  },
}

export type Messages = (typeof resources)["en"]
export type Locale = keyof typeof resources
