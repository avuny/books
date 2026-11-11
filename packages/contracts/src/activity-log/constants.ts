import { MODULE_LIST, type EventOf, type ModuleKey } from "../modules/index.js"

// ---------------------------------------------------------------------------
// DERIVED from the module registry (modules/registry.ts): every action with an
// `event` becomes the activity-log action `<module>.<event>`. Do not list
// resources or actions here.
//
// Rows keep their action string forever (the column is plain text on purpose),
// so never remove or rename an event that has shipped.
// ---------------------------------------------------------------------------

/** Modules that log at least one event. */
export type ActivityLogResource = {
  [K in ModuleKey]: [EventOf<K>] extends [never] ? never : K
}[ModuleKey]

/** "organization.created" | "organization_user.username_changed" | ... */
export type ActivityLogAction = { [K in ModuleKey]: `${K}.${EventOf<K>}` }[ModuleKey]

const logged = MODULE_LIST.filter((m) => m.events.length > 0)

export const ACTIVITY_LOG_RESOURCES = logged.map((m) => m.key) as [
  ActivityLogResource,
  ...ActivityLogResource[],
]

export const ACTIVITY_LOG_ACTIONS = logged.flatMap((m) =>
  m.events.map((event) => `${m.key}.${event}`)
) as [ActivityLogAction, ...ActivityLogAction[]]

/** "organization_user.joined" -> "ORGANIZATION_USER_JOINED" */
type ConstantName<A extends string> = A extends `${infer R}.${infer E}`
  ? Uppercase<`${R}_${E}`>
  : never

/** `ActivityLogResource.ORGANIZATION_USER === "organization_user"` */
export const ActivityLogResource = Object.fromEntries(
  ACTIVITY_LOG_RESOURCES.map((r) => [r.toUpperCase(), r])
) as { readonly [R in ActivityLogResource as Uppercase<R>]: R }

/** `ActivityLogAction.ORGANIZATION_USER_JOINED === "organization_user.joined"` */
export const ActivityLogAction = Object.fromEntries(
  ACTIVITY_LOG_ACTIONS.map((a) => [a.replace(".", "_").toUpperCase(), a])
) as { readonly [A in ActivityLogAction as ConstantName<A>]: A }

export const ACTIVITY_LOG_DEFAULT_PAGE_SIZE = 20
export const ACTIVITY_LOG_MAX_PAGE_SIZE = 100
