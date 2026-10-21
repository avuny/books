import {
  commonTranslationsEn,
  commonTranslationsAr,
} from "@avuny/contracts/common"
import { userTranslationsAr, userTranslationsEn } from "@avuny/contracts/user"

export const resources = {
  en: {
    common: commonTranslationsEn,
    user: userTranslationsEn,
  },
  ar: {
    common: commonTranslationsAr,
    user: userTranslationsAr,
  },
}

export type Messages = (typeof resources)["en"]
export type Locale = keyof typeof resources
