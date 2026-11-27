import i18next from "i18next"
import accountingEn from "./locales/accounting/en.json" with { type: "json" }
import accountingAr from "./locales/accounting/ar.json" with { type: "json" }
import adminEn from "./locales/admin/en.json" with { type: "json" }
import adminAr from "./locales/admin/ar.json" with { type: "json" }
import authEn from "./locales/auth/en.json" with { type: "json" }
import authAr from "./locales/auth/ar.json" with { type: "json" }
import batchEn from "./locales/batch/en.json" with { type: "json" }
import batchAr from "./locales/batch/ar.json" with { type: "json" }
import geoEn from "./locales/geo/en.json" with { type: "json" }
import geoAr from "./locales/geo/ar.json" with { type: "json" }
import inventoryAdjustmentEn from "./locales/inventory-adjustment/en.json" with { type: "json" }
import inventoryAdjustmentAr from "./locales/inventory-adjustment/ar.json" with { type: "json" }
import inventoryTransferEn from "./locales/inventory-transfer/en.json" with { type: "json" }
import inventoryTransferAr from "./locales/inventory-transfer/ar.json" with { type: "json" }
import itemEn from "./locales/item/en.json" with { type: "json" }
import itemAr from "./locales/item/ar.json" with { type: "json" }
import itemCategoryEn from "./locales/item-category/en.json" with { type: "json" }
import itemCategoryAr from "./locales/item-category/ar.json" with { type: "json" }
import organizationEn from "./locales/organization/en.json" with { type: "json" }
import organizationAr from "./locales/organization/ar.json" with { type: "json" }
import organizationInvitationEn from "./locales/organization-invitation/en.json" with { type: "json" }
import organizationInvitationAr from "./locales/organization-invitation/ar.json" with { type: "json" }
import organizationUserEn from "./locales/organization-user/en.json" with { type: "json" }
import organizationUserAr from "./locales/organization-user/ar.json" with { type: "json" }
import otpEn from "./locales/otp/en.json" with { type: "json" }
import otpAr from "./locales/otp/ar.json" with { type: "json" }
import partyEn from "./locales/party/en.json" with { type: "json" }
import partyAr from "./locales/party/ar.json" with { type: "json" }
import paymentTermEn from "./locales/payment-term/en.json" with { type: "json" }
import paymentTermAr from "./locales/payment-term/ar.json" with { type: "json" }
import purchaseOrderEn from "./locales/purchase-order/en.json" with { type: "json" }
import purchaseOrderAr from "./locales/purchase-order/ar.json" with { type: "json" }
import purchaseReceiptEn from "./locales/purchase-receipt/en.json" with { type: "json" }
import purchaseReceiptAr from "./locales/purchase-receipt/ar.json" with { type: "json" }
import purchaseShipmentEn from "./locales/purchase-shipment/en.json" with { type: "json" }
import purchaseShipmentAr from "./locales/purchase-shipment/ar.json" with { type: "json" }
import roleEn from "./locales/role/en.json" with { type: "json" }
import roleAr from "./locales/role/ar.json" with { type: "json" }
import salesDeliveryEn from "./locales/sales-delivery/en.json" with { type: "json" }
import salesDeliveryAr from "./locales/sales-delivery/ar.json" with { type: "json" }
import salesOrderEn from "./locales/sales-order/en.json" with { type: "json" }
import salesOrderAr from "./locales/sales-order/ar.json" with { type: "json" }
import sidebarEn from "./locales/sidebar/en.json" with { type: "json" }
import sidebarAr from "./locales/sidebar/ar.json" with { type: "json" }
import unitEn from "./locales/unit/en.json" with { type: "json" }
import unitAr from "./locales/unit/ar.json" with { type: "json" }
import unitCollectionEn from "./locales/unit-collection/en.json" with { type: "json" }
import unitCollectionAr from "./locales/unit-collection/ar.json" with { type: "json" }
import usersEn from "./locales/users/en.json" with { type: "json" }
import usersAr from "./locales/users/ar.json" with { type: "json" }
import vendorBillEn from "./locales/vendor-bill/en.json" with { type: "json" }
import vendorBillAr from "./locales/vendor-bill/ar.json" with { type: "json" }
import vendorPaymentEn from "./locales/vendor-payment/en.json" with { type: "json" }
import vendorPaymentAr from "./locales/vendor-payment/ar.json" with { type: "json" }
import warehouseEn from "./locales/warehouse/en.json" with { type: "json" }
import warehouseAr from "./locales/warehouse/ar.json" with { type: "json" }
import warehouseLocationEn from "./locales/warehouse-location/en.json" with { type: "json" }
import warehouseLocationAr from "./locales/warehouse-location/ar.json" with { type: "json" }
import { Locale } from "@avuny/i18n"

export const resources = {
  en: {
        accounting: accountingEn,
        admin: adminEn,
        auth: authEn,
        batch: batchEn,
        geo: geoEn,
        "inventory-adjustment": inventoryAdjustmentEn,
        inventoryAdjustment: inventoryAdjustmentEn,
        "inventory-transfer": inventoryTransferEn,
        inventoryTransfer: inventoryTransferEn,
        item: itemEn,
        "item-category": itemCategoryEn,
        itemCategory: itemCategoryEn,
        organization: organizationEn,
        "organization-invitation": organizationInvitationEn,
        organizationInvitation: organizationInvitationEn,
        "organization-user": organizationUserEn,
        organizationUser: organizationUserEn,
        otp: otpEn,
        party: partyEn,
        "payment-term": paymentTermEn,
        paymentTerm: paymentTermEn,
        "purchase-order": purchaseOrderEn,
        purchaseOrder: purchaseOrderEn,
        "purchase-receipt": purchaseReceiptEn,
        purchaseReceipt: purchaseReceiptEn,
        "purchase-shipment": purchaseShipmentEn,
        purchaseShipment: purchaseShipmentEn,
        role: roleEn,
        "sales-delivery": salesDeliveryEn,
        salesDelivery: salesDeliveryEn,
        "sales-order": salesOrderEn,
        salesOrder: salesOrderEn,
        sidebar: sidebarEn,
        unit: unitEn,
        "unit-collection": unitCollectionEn,
        unitCollection: unitCollectionEn,
        users: usersEn,
        "vendor-bill": vendorBillEn,
        vendorBill: vendorBillEn,
        "vendor-payment": vendorPaymentEn,
        vendorPayment: vendorPaymentEn,
        warehouse: warehouseEn,
        "warehouse-location": warehouseLocationEn,
        warehouseLocation: warehouseLocationEn,
  },
  ar: {
        accounting: accountingAr,
        admin: adminAr,
        auth: authAr,
        batch: batchAr,
        geo: geoAr,
        "inventory-adjustment": inventoryAdjustmentAr,
        inventoryAdjustment: inventoryAdjustmentAr,
        "inventory-transfer": inventoryTransferAr,
        inventoryTransfer: inventoryTransferAr,
        item: itemAr,
        "item-category": itemCategoryAr,
        itemCategory: itemCategoryAr,
        organization: organizationAr,
        "organization-invitation": organizationInvitationAr,
        organizationInvitation: organizationInvitationAr,
        "organization-user": organizationUserAr,
        organizationUser: organizationUserAr,
        otp: otpAr,
        party: partyAr,
        "payment-term": paymentTermAr,
        paymentTerm: paymentTermAr,
        "purchase-order": purchaseOrderAr,
        purchaseOrder: purchaseOrderAr,
        "purchase-receipt": purchaseReceiptAr,
        purchaseReceipt: purchaseReceiptAr,
        "purchase-shipment": purchaseShipmentAr,
        purchaseShipment: purchaseShipmentAr,
        role: roleAr,
        "sales-delivery": salesDeliveryAr,
        salesDelivery: salesDeliveryAr,
        "sales-order": salesOrderAr,
        salesOrder: salesOrderAr,
        sidebar: sidebarAr,
        unit: unitAr,
        "unit-collection": unitCollectionAr,
        unitCollection: unitCollectionAr,
        users: usersAr,
        "vendor-bill": vendorBillAr,
        vendorBill: vendorBillAr,
        "vendor-payment": vendorPaymentAr,
        vendorPayment: vendorPaymentAr,
        warehouse: warehouseAr,
        "warehouse-location": warehouseLocationAr,
        warehouseLocation: warehouseLocationAr,
  },
} as const

export type Resources = (typeof resources)["en"]

/**
 * Call once at startup. Never call i18n.changeLanguage() on the server: it is global and races
 * between concurrent requests. Use trans({ lang }) (= i18next.getFixedT) for every translation.
 */
export function installRequestLanguage(): void {
  i18next.init({
    lng: "en",
    fallbackLng: "en",
    ns: ["accounting", "admin", "auth", "batch", "geo", "inventory-adjustment", "inventoryAdjustment", "inventory-transfer", "inventoryTransfer", "item", "item-category", "itemCategory", "organization", "organization-invitation", "organizationInvitation", "organization-user", "organizationUser", "otp", "party", "payment-term", "paymentTerm", "purchase-order", "purchaseOrder", "purchase-receipt", "purchaseReceipt", "purchase-shipment", "purchaseShipment", "role", "sales-delivery", "salesDelivery", "sales-order", "salesOrder", "sidebar", "unit", "unit-collection", "unitCollection", "users", "vendor-bill", "vendorBill", "vendor-payment", "vendorPayment", "warehouse", "warehouse-location", "warehouseLocation"],
    defaultNS: "otp",
    resources,
    interpolation: { escapeValue: false },
  })
}

/**
 * Returns a fixed-t translator bound to the given language.
 * Use with handleResult's errorTrans param.
 *
 * @example
 *   const errorTrans = trans({ lang })
 *   // then pass errorTrans to handleResult
 */
export function trans({ lang }: { lang: Locale }) {
  return (key: string): string => i18next.t(key as any, { lng: lang })
}
