import { describe, expect, it } from "vitest"
import {
  ACTIVITY_LOG_ACTIONS,
  ActivityLogAction,
  PERMISSION_CATALOG,
  PERMISSION_CONCRETE_TOKEN_PATTERN,
  SIDEBAR_TREE,
  SYSTEM_ROLES,
  findInvalidStatement,
} from "@avuny/contracts"

const options = SIDEBAR_TREE.flatMap((h) => h.options)

/** Invariants of the module registry (packages/contracts/src/modules/registry.ts). */
describe("module registry", () => {
  it("resource, action and event names are plain snake_case tokens", () => {
    for (const { resource, actions } of PERMISSION_CATALOG) {
      expect(PERMISSION_CONCRETE_TOKEN_PATTERN.test(resource), resource).toBe(true)
      for (const a of actions) expect(PERMISSION_CONCRETE_TOKEN_PATTERN.test(a), a).toBe(true)
    }
    for (const action of ACTIVITY_LOG_ACTIONS) {
      const [resource, event, ...rest] = action.split(".")
      expect(rest, action).toHaveLength(0)
      expect(PERMISSION_CONCRETE_TOKEN_PATTERN.test(`${resource}`), action).toBe(true)
      expect(PERMISSION_CONCRETE_TOKEN_PATTERN.test(`${event}`), action).toBe(true)
    }
  })

  it("every logged action is unique and keeps its own constant", () => {
    expect(new Set(ACTIVITY_LOG_ACTIONS).size).toBe(ACTIVITY_LOG_ACTIONS.length)
    expect(Object.keys(ActivityLogAction)).toHaveLength(ACTIVITY_LOG_ACTIONS.length)
  })

  it("every sidebar option can be shown: its module has a grantable action", () => {
    for (const o of options) expect(o.permissionKeys.length > 0, o.name).toBe(true)
  })

  it("sidebar names and paths are unique, and no heading is empty", () => {
    expect(new Set(options.map((o) => o.name)).size).toBe(options.length)
    expect(new Set(options.map((o) => o.path)).size).toBe(options.length)
    for (const h of SIDEBAR_TREE) expect(h.options.length > 0, h.name).toBe(true)
  })

  it("system roles only reference resources and actions that exist", () => {
    for (const role of SYSTEM_ROLES) {
      expect(findInvalidStatement(role.statements), role.name).toBeNull()
    }
  })
})
