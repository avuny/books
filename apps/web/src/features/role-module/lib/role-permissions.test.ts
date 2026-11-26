import { describe, expect, it } from "vitest"

import type { PermissionStatementDto } from "../types"
import {
  countHiddenStatements,
  getGroupSelectionState,
  groupStatementsByResource,
  hasGrant,
  isPickableStatement,
  setGroupPermissions,
  toAllowStatement,
  togglePermission,
} from "./role-permissions"

const roleGroup = { resource: "role", actions: ["create", "read", "update"] }

const denyDelete: PermissionStatementDto = {
  effect: "deny",
  resource: "organization",
  action: "delete",
  resourceId: "*",
}
const allowAll: PermissionStatementDto = {
  effect: "allow",
  resource: "*",
  action: "*",
  resourceId: "*",
}

describe("isPickableStatement", () => {
  it("accepts plain allow grants only", () => {
    expect(isPickableStatement(toAllowStatement("read", "role"))).toBe(true)
    expect(isPickableStatement(denyDelete)).toBe(false)
    expect(isPickableStatement(allowAll)).toBe(false)
    expect(
      isPickableStatement({
        ...toAllowStatement("read", "role"),
        resourceId: "abc",
      })
    ).toBe(false)
  })
})

describe("togglePermission", () => {
  it("adds and removes a grant", () => {
    const added = togglePermission([], "read", "role")
    expect(added).toEqual([toAllowStatement("read", "role")])
    expect(hasGrant(added, "read", "role")).toBe(true)
    expect(togglePermission(added, "read", "role")).toEqual([])
  })

  it("keeps statements the picker cannot show", () => {
    const next = togglePermission([denyDelete, allowAll], "read", "role")
    expect(next).toContain(denyDelete)
    expect(next).toContain(allowAll)
  })
})

describe("group selection", () => {
  it("reports none, some and all", () => {
    expect(getGroupSelectionState([], roleGroup)).toBe("none")
    expect(
      getGroupSelectionState([toAllowStatement("read", "role")], roleGroup)
    ).toBe("some")
    expect(
      getGroupSelectionState(
        setGroupPermissions([], roleGroup, true),
        roleGroup
      )
    ).toBe("all")
  })

  it("clears a group without touching other statements", () => {
    const all = setGroupPermissions([denyDelete], roleGroup, true)
    expect(all).toHaveLength(4)
    expect(setGroupPermissions(all, roleGroup, false)).toEqual([denyDelete])
  })

  it("does not duplicate grants when selecting a partly selected group", () => {
    const partial = [toAllowStatement("read", "role")]
    const all = setGroupPermissions(partial, roleGroup, true)
    expect(all.filter((s) => s.action === "read")).toHaveLength(1)
  })
})

describe("countHiddenStatements", () => {
  it("counts wildcards, denies and grants outside the catalog", () => {
    expect(
      countHiddenStatements(
        [
          toAllowStatement("read", "role"),
          denyDelete,
          allowAll,
          toAllowStatement("read", "retired_resource"),
        ],
        [roleGroup]
      )
    ).toBe(3)
  })
})

describe("groupStatementsByResource", () => {
  it("groups by resource in first-seen order", () => {
    const groups = groupStatementsByResource([
      toAllowStatement("read", "role"),
      denyDelete,
      toAllowStatement("update", "role"),
    ])
    expect(groups.map((g) => g.resource)).toEqual(["role", "organization"])
    expect(groups[0]?.entries.map((e) => e.action)).toEqual(["read", "update"])
    expect(groups[1]?.entries[0]?.effect).toBe("deny")
  })
})
