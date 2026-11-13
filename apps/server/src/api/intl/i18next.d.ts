import type adminEn from "./locales/admin/en.json"
import type authEn from "./locales/auth/en.json"
import type geoEn from "./locales/geo/en.json"
import type itemEn from "./locales/item/en.json"
import type itemCategoryEn from "./locales/item-category/en.json"
import type organizationEn from "./locales/organization/en.json"
import type organizationInvitationEn from "./locales/organization-invitation/en.json"
import type organizationUserEn from "./locales/organization-user/en.json"
import type otpEn from "./locales/otp/en.json"
import type roleEn from "./locales/role/en.json"
import type sidebarEn from "./locales/sidebar/en.json"
import type unitEn from "./locales/unit/en.json"
import type unitCollectionEn from "./locales/unit-collection/en.json"
import type usersEn from "./locales/users/en.json"
import type warehouseEn from "./locales/warehouse/en.json"
import type warehouseLocationEn from "./locales/warehouse-location/en.json"

type AdminMessages = typeof adminEn
type AuthMessages = typeof authEn
type GeoMessages = typeof geoEn
type ItemMessages = typeof itemEn
type ItemCategoryMessages = typeof itemCategoryEn
type OrganizationMessages = typeof organizationEn
type OrganizationInvitationMessages = typeof organizationInvitationEn
type OrganizationUserMessages = typeof organizationUserEn
type OtpMessages = typeof otpEn
type RoleMessages = typeof roleEn
type SidebarMessages = typeof sidebarEn
type UnitMessages = typeof unitEn
type UnitCollectionMessages = typeof unitCollectionEn
type UsersMessages = typeof usersEn
type WarehouseMessages = typeof warehouseEn
type WarehouseLocationMessages = typeof warehouseLocationEn

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "otp"
    resources: {
      admin: AdminMessages
      auth: AuthMessages
      geo: GeoMessages
      item: ItemMessages
      "item-category": ItemCategoryMessages
      itemCategory: ItemCategoryMessages
      organization: OrganizationMessages
      "organization-invitation": OrganizationInvitationMessages
      organizationInvitation: OrganizationInvitationMessages
      "organization-user": OrganizationUserMessages
      organizationUser: OrganizationUserMessages
      otp: OtpMessages
      role: RoleMessages
      sidebar: SidebarMessages
      unit: UnitMessages
      "unit-collection": UnitCollectionMessages
      unitCollection: UnitCollectionMessages
      users: UsersMessages
      warehouse: WarehouseMessages
      "warehouse-location": WarehouseLocationMessages
      warehouseLocation: WarehouseLocationMessages
    }
  }
}
