import { describe, expect, it } from "vitest"
import { drizzle } from "drizzle-orm/neon-http"
import { roles } from "@avuny/db"
import { memberCountSql, permissionCountSql } from "./role.repository.js"

describe("role list count subqueries (audit B7)", () => {
  const db = drizzle("postgres://u:p@localhost/db")
  const { sql: text } = db
    .select({ permissionCount: permissionCountSql(), memberCount: memberCountSql("org-1") })
    .from(roles)
    .toSQL()

  it("compares against the outer roles.id, not a bare id", () => {
    expect(text).toContain('"role_id" = "roles"."id"')
    expect(text).not.toMatch(/"role_id" = "id"/)
  })

  it("counts members only of the given organization", () => {
    expect(text).toContain('"org_id" = $1')
  })
})
