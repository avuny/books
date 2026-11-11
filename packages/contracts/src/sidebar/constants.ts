import type { PermissionKey } from "../role/permission-catalog.js"
import {
  camel,
  MODULE_LIST,
  SIDEBAR_GROUPS,
  type Camel,
  type Localized,
  type SidebarGroup,
  type SidebarModuleKey,
} from "../modules/index.js"

// ---------------------------------------------------------------------------
// DERIVED from the module registry (modules/registry.ts): headings come from
// SIDEBAR_GROUPS, options from the modules that have a `sidebar` entry. The
// order here IS the order of the sidebar. Do not list names here.
// ---------------------------------------------------------------------------

export type SidebarHeadingType = SidebarGroup
/** "organization_user" -> "organizationUser" */
export type SidebarOptionName = Camel<SidebarModuleKey>

export interface SidebarTreeOption {
  name: SidebarOptionName
  label: Localized
  /** Icon key understood by the web app (lucide names). */
  icon: string
  /** Org-relative path; the web app prefixes it with the active organization. */
  path: string
  /**
   * The option is visible to anyone holding AT LEAST ONE of these (every grantable action
   * of its module).
   */
  permissionKeys: readonly PermissionKey[]
}

export interface SidebarTreeHeading {
  name: SidebarHeadingType
  label: Localized
  icon: string
  options: readonly SidebarTreeOption[]
}

/** The whole sidebar, in display order. The seed, the column types and the labels all read this. */
export const SIDEBAR_TREE: readonly SidebarTreeHeading[] = Object.entries(
  SIDEBAR_GROUPS
).map(([name, group]) => ({
  name: name as SidebarHeadingType,
  label: group.label,
  icon: group.icon,
  options: MODULE_LIST.flatMap(({ key, spec, permissionKeys }) =>
    spec.sidebar?.group === name
      ? [
          {
            name: camel(key) as SidebarOptionName,
            label: spec.sidebar.label,
            icon: spec.sidebar.icon,
            path: spec.sidebar.path,
            permissionKeys: permissionKeys as readonly PermissionKey[],
          },
        ]
      : []
  ),
}))

/** Values (and, through the same-named types, the column types) of the sidebar tables' `name`. */
export const SidebarHeadingType = SIDEBAR_TREE.map((h) => h.name) as [
  SidebarHeadingType,
  ...SidebarHeadingType[],
]
export const SidebarOptionName = SIDEBAR_TREE.flatMap((h) =>
  h.options.map((o) => o.name)
) as [SidebarOptionName, ...SidebarOptionName[]]
