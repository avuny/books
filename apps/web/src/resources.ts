import {
  commonTranslationsEn,
  commonTranslationsAr,
} from "@avuny/contracts/common"
import { userTranslationsAr, userTranslationsEn } from "@avuny/contracts/user"
import {
  organizationTranslationsAr,
  organizationTranslationsEn,
} from "@avuny/contracts/organization"

export const resources = {
  en: {
    common: commonTranslationsEn,
    user: userTranslationsEn,
    organization: organizationTranslationsEn,
  },
  ar: {
    common: commonTranslationsAr,
    user: userTranslationsAr,
    organization: organizationTranslationsAr,
  },
}

export type Messages = (typeof resources)["en"]
export type Locale = keyof typeof resources
