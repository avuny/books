import type adminEn from "./locales/admin/en.json"
import type authEn from "./locales/auth/en.json"
import type geoEn from "./locales/geo/en.json"
import type organizationEn from "./locales/organization/en.json"
import type organizationInvitationEn from "./locales/organization-invitation/en.json"
import type organizationUserEn from "./locales/organization-user/en.json"
import type otpEn from "./locales/otp/en.json"
import type roleEn from "./locales/role/en.json"
import type sidebarEn from "./locales/sidebar/en.json"
import type usersEn from "./locales/users/en.json"

type AdminMessages = typeof adminEn
type AuthMessages = typeof authEn
type GeoMessages = typeof geoEn
type OrganizationMessages = typeof organizationEn
type OrganizationInvitationMessages = typeof organizationInvitationEn
type OrganizationUserMessages = typeof organizationUserEn
type OtpMessages = typeof otpEn
type RoleMessages = typeof roleEn
type SidebarMessages = typeof sidebarEn
type UsersMessages = typeof usersEn

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "otp"
    resources: {
      admin: AdminMessages
      auth: AuthMessages
      geo: GeoMessages
      organization: OrganizationMessages
      "organization-invitation": OrganizationInvitationMessages
      organizationInvitation: OrganizationInvitationMessages
      "organization-user": OrganizationUserMessages
      organizationUser: OrganizationUserMessages
      otp: OtpMessages
      role: RoleMessages
      sidebar: SidebarMessages
      users: UsersMessages
    }
  }
}
