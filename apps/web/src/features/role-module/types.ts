import type {
  CreateRoleInput,
  PermissionStatementDto,
  RoleDto,
  RoleListItemDto,
  UpdateRoleInput,
} from "@avuny/contracts"

export type {
  CreateRoleInput,
  PermissionStatementDto,
  RoleDto,
  RoleListItemDto,
  UpdateRoleInput,
}

/** One catalog resource and the actions a role can be granted on it. */
export type PermissionGroup = {
  resource: string
  actions: string[]
}

export type RoleScope = "all" | "system" | "custom"
