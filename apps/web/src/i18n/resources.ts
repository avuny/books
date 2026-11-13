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
import { roleTranslationsAr, roleTranslationsEn } from "@avuny/contracts/role"
import { unitTranslationsAr, unitTranslationsEn } from "@avuny/contracts/unit"
import {
  unitCollectionTranslationsAr,
  unitCollectionTranslationsEn,
} from "@avuny/contracts/unit-collection"
import { userTranslationsAr, userTranslationsEn } from "@avuny/contracts/user"
import {
  warehouseTranslationsAr,
  warehouseTranslationsEn,
} from "@avuny/contracts/warehouse"
import {
  warehouseLocationTranslationsAr,
  warehouseLocationTranslationsEn,
} from "@avuny/contracts/warehouse-location"

export const resources = {
  en: {
    common: commonTranslationsEn,
    item: itemTranslationsEn,
    "item-category": itemCategoryTranslationsEn,
    organization: organizationTranslationsEn,
    "organization-invitation": organizationInvitationTranslationsEn,
    "organization-user": organizationUserTranslationsEn,
    role: roleTranslationsEn,
    unit: unitTranslationsEn,
    "unit-collection": unitCollectionTranslationsEn,
    user: userTranslationsEn,
    warehouse: warehouseTranslationsEn,
    "warehouse-location": warehouseLocationTranslationsEn,

  },
  ar: {
    common: commonTranslationsAr,
    item: itemTranslationsAr,
    "item-category": itemCategoryTranslationsAr,
    organization: organizationTranslationsAr,
    "organization-invitation": organizationInvitationTranslationsAr,
    "organization-user": organizationUserTranslationsAr,
    role: roleTranslationsAr,
    unit: unitTranslationsAr,
    "unit-collection": unitCollectionTranslationsAr,
    user: userTranslationsAr,
    warehouse: warehouseTranslationsAr,
    "warehouse-location": warehouseLocationTranslationsAr,

  },
}

export type Messages = (typeof resources)["en"]
export type Locale = keyof typeof resources
