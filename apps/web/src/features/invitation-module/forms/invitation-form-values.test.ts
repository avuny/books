import { describe, expect, it } from "vitest"

import {
  CREATE_INVITATION_DEFAULTS,
  toAcceptInvitationInput,
  toCreateInvitationInput,
} from "./invitation-form-values"

describe("toCreateInvitationInput", () => {
  it("sends only the email for the email channel", () => {
    expect(
      toCreateInvitationInput({
        ...CREATE_INVITATION_DEFAULTS,
        email: " Sam@Example.com ",
        phone: "+201001234567", // left over from switching channels
      })
    ).toEqual({
      type: "managed",
      channel: "email",
      email: "Sam@Example.com",
      phone: undefined,
      username: undefined,
    })
  })

  it("sends only a normalized phone for the WhatsApp channel", () => {
    expect(
      toCreateInvitationInput({
        ...CREATE_INVITATION_DEFAULTS,
        type: "portal",
        channel: "whatsapp",
        email: "left-over@example.com",
        phone: "+20 100 123-4567",
        username: " sam ",
      })
    ).toEqual({
      type: "portal",
      channel: "whatsapp",
      email: undefined,
      phone: "+201001234567",
      username: "sam",
    })
  })

  it("treats an empty contact as missing so the schema can report it", () => {
    const input = toCreateInvitationInput(CREATE_INVITATION_DEFAULTS)
    expect(input.email).toBeUndefined()
    expect(input.phone).toBeUndefined()
  })
})

describe("toAcceptInvitationInput", () => {
  it("drops a blank username", () => {
    expect(toAcceptInvitationInput({ username: "  " })).toEqual({
      username: undefined,
    })
    expect(toAcceptInvitationInput({ username: "sam" })).toEqual({
      username: "sam",
    })
  })
})
