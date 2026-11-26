import type accountingEn from "./locales/accounting/en.json"
import type adminEn from "./locales/admin/en.json"
import type authEn from "./locales/auth/en.json"
import type batchEn from "./locales/batch/en.json"
import type geoEn from "./locales/geo/en.json"
import type inventoryAdjustmentEn from "./locales/inventory-adjustment/en.json"
import type inventoryTransferEn from "./locales/inventory-transfer/en.json"
import type itemEn from "./locales/item/en.json"
import type itemCategoryEn from "./locales/item-category/en.json"
import type organizationEn from "./locales/organization/en.json"
import type organizationInvitationEn from "./locales/organization-invitation/en.json"
import type organizationUserEn from "./locales/organization-user/en.json"
import type otpEn from "./locales/otp/en.json"
import type partyEn from "./locales/party/en.json"
import type paymentTermEn from "./locales/payment-term/en.json"
import type purchaseOrderEn from "./locales/purchase-order/en.json"
import type purchaseReceiptEn from "./locales/purchase-receipt/en.json"
import type purchaseShipmentEn from "./locales/purchase-shipment/en.json"
import type roleEn from "./locales/role/en.json"
import type sidebarEn from "./locales/sidebar/en.json"
import type unitEn from "./locales/unit/en.json"
import type unitCollectionEn from "./locales/unit-collection/en.json"
import type usersEn from "./locales/users/en.json"
import type vendorBillEn from "./locales/vendor-bill/en.json"
import type vendorPaymentEn from "./locales/vendor-payment/en.json"
import type warehouseEn from "./locales/warehouse/en.json"
import type warehouseLocationEn from "./locales/warehouse-location/en.json"

type AccountingMessages = typeof accountingEn
type AdminMessages = typeof adminEn
type AuthMessages = typeof authEn
type BatchMessages = typeof batchEn
type GeoMessages = typeof geoEn
type InventoryAdjustmentMessages = typeof inventoryAdjustmentEn
type InventoryTransferMessages = typeof inventoryTransferEn
type ItemMessages = typeof itemEn
type ItemCategoryMessages = typeof itemCategoryEn
type OrganizationMessages = typeof organizationEn
type OrganizationInvitationMessages = typeof organizationInvitationEn
type OrganizationUserMessages = typeof organizationUserEn
type OtpMessages = typeof otpEn
type PartyMessages = typeof partyEn
type PaymentTermMessages = typeof paymentTermEn
type PurchaseOrderMessages = typeof purchaseOrderEn
type PurchaseReceiptMessages = typeof purchaseReceiptEn
type PurchaseShipmentMessages = typeof purchaseShipmentEn
type RoleMessages = typeof roleEn
type SidebarMessages = typeof sidebarEn
type UnitMessages = typeof unitEn
type UnitCollectionMessages = typeof unitCollectionEn
type UsersMessages = typeof usersEn
type VendorBillMessages = typeof vendorBillEn
type VendorPaymentMessages = typeof vendorPaymentEn
type WarehouseMessages = typeof warehouseEn
type WarehouseLocationMessages = typeof warehouseLocationEn

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "otp"
    resources: {
      accounting: AccountingMessages
      admin: AdminMessages
      auth: AuthMessages
      batch: BatchMessages
      geo: GeoMessages
      "inventory-adjustment": InventoryAdjustmentMessages
      inventoryAdjustment: InventoryAdjustmentMessages
      "inventory-transfer": InventoryTransferMessages
      inventoryTransfer: InventoryTransferMessages
      item: ItemMessages
      "item-category": ItemCategoryMessages
      itemCategory: ItemCategoryMessages
      organization: OrganizationMessages
      "organization-invitation": OrganizationInvitationMessages
      organizationInvitation: OrganizationInvitationMessages
      "organization-user": OrganizationUserMessages
      organizationUser: OrganizationUserMessages
      otp: OtpMessages
      party: PartyMessages
      "payment-term": PaymentTermMessages
      paymentTerm: PaymentTermMessages
      "purchase-order": PurchaseOrderMessages
      purchaseOrder: PurchaseOrderMessages
      "purchase-receipt": PurchaseReceiptMessages
      purchaseReceipt: PurchaseReceiptMessages
      "purchase-shipment": PurchaseShipmentMessages
      purchaseShipment: PurchaseShipmentMessages
      role: RoleMessages
      sidebar: SidebarMessages
      unit: UnitMessages
      "unit-collection": UnitCollectionMessages
      unitCollection: UnitCollectionMessages
      users: UsersMessages
      "vendor-bill": VendorBillMessages
      vendorBill: VendorBillMessages
      "vendor-payment": VendorPaymentMessages
      vendorPayment: VendorPaymentMessages
      warehouse: WarehouseMessages
      "warehouse-location": WarehouseLocationMessages
      warehouseLocation: WarehouseLocationMessages
    }
  }
}
