import { MODULES, type ActionSpec, type ModuleSpec } from "./registry.js"

/* ---------- naming: one module key, three spellings ---------- */

/** "organization_user" -> "organization-user" (the part after the colon in a permission key). */
export type Hyphenate<S extends string> = S extends `${infer A}_${infer B}`
  ? `${A}-${Hyphenate<B>}`
  : S
/** "organization_user" -> "organizationUser" (sidebar option names). */
export type Camel<S extends string> = S extends `${infer A}_${infer B}`
  ? `${A}${Capitalize<Camel<B>>}`
  : S

export const hyphenate = <S extends string>(s: S) => s.replace(/_/g, "-") as Hyphenate<S>
export const camel = <S extends string>(s: S) =>
  s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase()) as Camel<S>

/* ---------- types ---------- */

export type ModuleKey = keyof typeof MODULES

type ActionsOf<K extends ModuleKey> = (typeof MODULES)[K]["actions"]
type ActionName<K extends ModuleKey> = keyof ActionsOf<K> & string

/** Actions of K a role can be granted. */
export type PermissionActionOf<K extends ModuleKey> = {
  [A in ActionName<K>]: ActionsOf<K>[A] extends { permission: true } ? A : never
}[ActionName<K>]

/** Event names K writes to the activity log. */
export type EventOf<K extends ModuleKey> = {
  [A in ActionName<K>]: ActionsOf<K>[A] extends { event: infer E extends string } ? E : never
}[ActionName<K>]

/** Modules that appear in the sidebar. */
export type SidebarModuleKey = {
  [K in ModuleKey]: (typeof MODULES)[K] extends { sidebar: unknown } ? K : never
}[ModuleKey]

/* ---------- runtime view ---------- */

export interface ModuleView {
  readonly key: ModuleKey
  readonly spec: ModuleSpec
  /** Grantable action names, in declaration order. */
  readonly permissions: readonly string[]
  /** `<action>:<module-with-hyphens>` for each grantable action. */
  readonly permissionKeys: readonly string[]
  /** Activity-log event names, in declaration order. */
  readonly events: readonly string[]
}

const specs: Readonly<Record<ModuleKey, ModuleSpec>> = MODULES

/** The registry as plain data. The typed views live next to their consumers. */
export const MODULE_LIST: readonly ModuleView[] = (Object.keys(specs) as ModuleKey[]).map(
  (key) => {
    const actions = Object.values<ActionSpec>(specs[key].actions)
    const permissions = Object.entries<ActionSpec>(specs[key].actions)
      .filter(([, a]) => a.permission)
      .map(([name]) => name)
    return {
      key,
      spec: specs[key],
      permissions,
      permissionKeys: permissions.map((a) => `${a}:${hyphenate(key)}`),
      events: actions.flatMap((a) => (a.event ? [a.event] : [])),
    }
  }
)
