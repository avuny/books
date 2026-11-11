import {
  commonTranslationsAr,
  commonTranslationsEn,
} from "@avuny/contracts/common"
import { itemTranslationsAr, itemTranslationsEn } from "@avuny/contracts/item"
import {
  itemCategoryTranslationsAr,
  itemCategoryTranslationsEn,
} from "@avuny/contracts/item-category"
import {
  organizationTranslationsAr,
  organizationTranslationsEn,
} from "@avuny/contracts/organization"
import {
  organizationInvitationTranslationsAr,
  organizationInvitationTranslationsEn,
} from "@avuny/contracts/organization-invitation"
import {
  organizationUserTranslationsAr,
  organizationUserTranslationsEn,
} from "@avuny/contracts/organization-user"
import { roleTranslationsAr, roleTranslationsEn } from "@avuny/contracts"
import { unitTranslationsAr, unitTranslationsEn } from "@avuny/contracts/unit"
import {
  unitCollectionTranslationsAr,
  unitCollectionTranslationsEn,
} from "@avuny/contracts/unit-collection"
import { userTranslationsAr, userTranslationsEn } from "@avuny/contracts/user"

export const resources = {
  en: {
    common: commonTranslationsEn,
    user: userTranslationsEn,
    organization: organizationTranslationsEn,
    role: roleTranslationsEn,
    "organization-invitation": organizationInvitationTranslationsEn,
    "organization-user": organizationUserTranslationsEn,
    unit: unitTranslationsEn,
    "unit-collection": unitCollectionTranslationsEn,
    item: itemTranslationsEn,
    "item-category": itemCategoryTranslationsEn,
  },
  ar: {
    common: commonTranslationsAr,
    user: userTranslationsAr,
    organization: organizationTranslationsAr,
    role: roleTranslationsAr,
    "organization-invitation": organizationInvitationTranslationsAr,
    "organization-user": organizationUserTranslationsAr,
    unit: unitTranslationsAr,
    "unit-collection": unitCollectionTranslationsAr,
    item: itemTranslationsAr,
    "item-category": itemCategoryTranslationsAr,
  },
}

export type Messages = (typeof resources)["en"]
export type Locale = keyof typeof resources
