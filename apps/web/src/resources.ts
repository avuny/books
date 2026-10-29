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

export const resources = {
  en: {
    common: commonTranslationsEn,
    user: userTranslationsEn,
    organization: organizationTranslationsEn,
    role: roleTranslationsEn,
  },
  ar: {
    common: commonTranslationsAr,
    user: userTranslationsAr,
    organization: organizationTranslationsAr,
    role: roleTranslationsAr,
  },
}

export type Messages = (typeof resources)["en"]
export type Locale = keyof typeof resources
