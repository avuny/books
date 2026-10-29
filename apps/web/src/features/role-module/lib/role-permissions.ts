import type { PermissionGroup, PermissionStatementDto } from "../types"

const WILDCARD = "*"

export type GroupSelectionState = "all" | "some" | "none"

export function toAllowStatement(
  action: string,
  resource: string
): PermissionStatementDto {
  return { effect: "allow", resource, action, resourceId: WILDCARD }
}

/**
 * A plain "allow <action> on <resource>" grant. These are the only statements
 * the checkbox picker can show; wildcards, denies and record-scoped statements
 * are kept untouched when the picker changes the selection.
 */
export function isPickableStatement(
  statement: PermissionStatementDto
): boolean {
  return (
    statement.effect === "allow" &&
    statement.resourceId === WILDCARD &&
    statement.resource !== WILDCARD &&
    statement.action !== WILDCARD
  )
}

function isGrant(
  statement: PermissionStatementDto,
  action: string,
  resource: string
): boolean {
  return (
    isPickableStatement(statement) &&
    statement.action === action &&
    statement.resource === resource
  )
}

export function hasGrant(
  statements: readonly PermissionStatementDto[],
  action: string,
  resource: string
): boolean {
  return statements.some((statement) => isGrant(statement, action, resource))
}

export function togglePermission(
  statements: readonly PermissionStatementDto[],
  action: string,
  resource: string
): PermissionStatementDto[] {
  return hasGrant(statements, action, resource)
    ? statements.filter((statement) => !isGrant(statement, action, resource))
    : [...statements, toAllowStatement(action, resource)]
}

export function getGroupSelectionState(
  statements: readonly PermissionStatementDto[],
  group: PermissionGroup
): GroupSelectionState {
  const count = group.actions.filter((action) =>
    hasGrant(statements, action, group.resource)
  ).length
  if (count === 0) return "none"
  return count === group.actions.length ? "all" : "some"
}

/** Grants or clears every action of one resource, leaving other statements alone. */
export function setGroupPermissions(
  statements: readonly PermissionStatementDto[],
  group: PermissionGroup,
  checked: boolean
): PermissionStatementDto[] {
  const rest = statements.filter(
    (statement) =>
      !group.actions.some((action) =>
        isGrant(statement, action, group.resource)
      )
  )
  return checked
    ? [
        ...rest,
        ...group.actions.map((action) =>
          toAllowStatement(action, group.resource)
        ),
      ]
    : rest
}

/** Statements the picker cannot show (wildcards, denies, scoped, unknown). */
export function countHiddenStatements(
  statements: readonly PermissionStatementDto[],
  groups: readonly PermissionGroup[]
): number {
  return statements.filter(
    (statement) =>
      !(
        isPickableStatement(statement) &&
        groups.some(
          (group) =>
            group.resource === statement.resource &&
            group.actions.includes(statement.action)
        )
      )
  ).length
}

export type StatementEntry = {
  id: string
  effect: PermissionStatementDto["effect"]
  action: string
  resourceId: string
}

export type StatementGroup = {
  resource: string
  entries: StatementEntry[]
}

/** Groups statements by resource for read-only display (keeps first-seen order). */
export function groupStatementsByResource(
  statements: readonly PermissionStatementDto[]
): StatementGroup[] {
  const byResource = new Map<string, StatementEntry[]>()

  for (const statement of statements) {
    const entries = byResource.get(statement.resource) ?? []
    entries.push({
      id: `${statement.effect}:${statement.action}:${statement.resourceId}`,
      effect: statement.effect,
      action: statement.action,
      resourceId: statement.resourceId,
    })
    byResource.set(statement.resource, entries)
  }

  return Array.from(byResource, ([resource, entries]) => ({
    resource,
    entries,
  }))
}
