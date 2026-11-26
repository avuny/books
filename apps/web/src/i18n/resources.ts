import {
  accountingTranslationsAr,
  accountingTranslationsEn,
} from "@avuny/contracts/accounting"
import {
  batchTranslationsAr,
  batchTranslationsEn,
} from "@avuny/contracts/batch"
import {
  commonTranslationsAr,
  commonTranslationsEn,
} from "@avuny/contracts/common"
import {
  inventoryAdjustmentTranslationsAr,
  inventoryAdjustmentTranslationsEn,
} from "@avuny/contracts/inventory-adjustment"
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
import {
  partyTranslationsAr,
  partyTranslationsEn,
} from "@avuny/contracts/party"
import {
  paymentTermTranslationsAr,
  paymentTermTranslationsEn,
} from "@avuny/contracts/payment-term"
import {
  purchaseOrderTranslationsAr,
  purchaseOrderTranslationsEn,
} from "@avuny/contracts/purchase-order"
import {
  purchaseShipmentTranslationsAr,
  purchaseShipmentTranslationsEn,
} from "@avuny/contracts/purchase-shipment"
import { roleTranslationsAr, roleTranslationsEn } from "@avuny/contracts/role"
import {
  stockMovementTranslationsAr,
  stockMovementTranslationsEn,
} from "@avuny/contracts/stock-movement"
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
    accounting: accountingTranslationsEn,
    batch: batchTranslationsEn,
    common: commonTranslationsEn,
    "inventory-adjustment": inventoryAdjustmentTranslationsEn,
    item: itemTranslationsEn,
    "item-category": itemCategoryTranslationsEn,
    organization: organizationTranslationsEn,
    "organization-invitation": organizationInvitationTranslationsEn,
    "organization-user": organizationUserTranslationsEn,
    party: partyTranslationsEn,
    "payment-term": paymentTermTranslationsEn,
    "purchase-order": purchaseOrderTranslationsEn,
    "purchase-shipment": purchaseShipmentTranslationsEn,
    role: roleTranslationsEn,
    "stock-movement": stockMovementTranslationsEn,
    unit: unitTranslationsEn,
    "unit-collection": unitCollectionTranslationsEn,
    user: userTranslationsEn,
    warehouse: warehouseTranslationsEn,
    "warehouse-location": warehouseLocationTranslationsEn,
  },
  ar: {
    accounting: accountingTranslationsAr,
    batch: batchTranslationsAr,
    common: commonTranslationsAr,
    "inventory-adjustment": inventoryAdjustmentTranslationsAr,
    item: itemTranslationsAr,
    "item-category": itemCategoryTranslationsAr,
    organization: organizationTranslationsAr,
    "organization-invitation": organizationInvitationTranslationsAr,
    "organization-user": organizationUserTranslationsAr,
    party: partyTranslationsAr,
    "payment-term": paymentTermTranslationsAr,
    "purchase-order": purchaseOrderTranslationsAr,
    "purchase-shipment": purchaseShipmentTranslationsAr,
    role: roleTranslationsAr,
    "stock-movement": stockMovementTranslationsAr,
    unit: unitTranslationsAr,
    "unit-collection": unitCollectionTranslationsAr,
    user: userTranslationsAr,
    warehouse: warehouseTranslationsAr,
    "warehouse-location": warehouseLocationTranslationsAr,
  },
}

export type Messages = (typeof resources)["en"]
export type Locale = keyof typeof resources
