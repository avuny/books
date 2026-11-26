import type { FieldCopy } from "@workspace/ui/blocks/types"

import type { PermissionGroup } from "../types"

export type RolePermissionsFieldCopy = {
  label: string
  description?: string
  /** Shown when the catalog has no permissions. */
  empty: string
  /** Note about statements the picker keeps but cannot show (wildcards, denies). */
  advancedNote: (count: number) => string
}

/** Catalog data plus the label resolvers, injected into the permissions field. */
export type RolePermissionsOptions = {
  groups: PermissionGroup[]
  isLoading: boolean
  getResourceLabel: (resource: string) => string
  getActionLabel: (action: string) => string
}

/** Localized strings shared by the create and update forms. */
export type RoleFormCopy = {
  title: string
  description: string
  name: FieldCopy
  roleDescription: FieldCopy
  permissions: RolePermissionsFieldCopy
  submitLabel: string
  submittingLabel: string
}
