import type { OrganizationDto } from "@avuny/contracts"
import type { Organization } from "@avuny/db"

export function toOrganizationDto(o: Organization): OrganizationDto {
  return {
    id: o.id,
    code: o.code,
    name: o.name,
    status: o.status,
    countryCode: o.countryCode,
    stateId: o.stateId,
    defaultCurrency: o.defaultCurrency,
    timezone: o.timezone,
  }
}

