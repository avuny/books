import { describe, expect, it } from "vitest"

import {
  toAcceptInvitationInput,
  toCreateInvitationInput,
} from "./invitation-form-values"

describe("toCreateInvitationInput", () => {
  it("normalizes identifier and roleId", () => {
    expect(
      toCreateInvitationInput({
        identifier: " Sam@Example.com ",
        roleId: " 123e4567-e89b-12d3-a456-426614174000 ",
      })
    ).toEqual({
      identifier: "sam@example.com",
      roleId: "123e4567-e89b-12d3-a456-426614174000",
    })
  })

  it("treats empty roleId as undefined", () => {
    expect(
      toCreateInvitationInput({
        identifier: "sam@example.com",
        roleId: "",
      })
    ).toEqual({
      identifier: "sam@example.com",
      roleId: undefined,
    })
  })
})

describe("toAcceptInvitationInput", () => {
  it("returns empty input object", () => {
    expect(toAcceptInvitationInput({})).toEqual({})
  })
})
