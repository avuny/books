import { describe, expect, it } from "vitest"

import {
  toEditMemberInput,
  toTransferOwnershipInput,
} from "./member-form-values"

describe("toEditMemberInput", () => {
  it("passes the username through for the schema to normalize", () => {
    expect(toEditMemberInput({ username: " Sara " })).toEqual({
      username: " Sara ",
    })
  })
})

describe("toTransferOwnershipInput", () => {
  it("adds the target member id to the typed code", () => {
    expect(
      toTransferOwnershipInput("member-1")({ confirmCode: "ACME" })
    ).toEqual({ newOwnerMemberId: "member-1", confirmCode: "ACME" })
  })
})
