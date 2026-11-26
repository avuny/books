import { describe, expect, it } from "vitest"
import { pickCurrency, pickTimezone } from "./country-defaults"

const currencies = [{ value: "USD" }, { value: "EGP" }]

describe("pickCurrency (audit B10)", () => {
  it("uses the country's currency when it can be selected", () => {
    expect(pickCurrency("EGP", currencies, "USD")).toBe("EGP")
  })
  it("keeps the current value for unknown or missing currencies", () => {
    expect(pickCurrency("XXX", currencies, "USD")).toBe("USD")
    expect(pickCurrency(null, currencies, "USD")).toBe("USD")
  })
})

describe("pickTimezone (audit B10)", () => {
  it("switches UTC to the country's first timezone", () => {
    expect(pickTimezone([{ value: "Africa/Cairo" }], "UTC")).toBe("Africa/Cairo")
  })
  it("keeps a timezone that already belongs to the country", () => {
    const zones = [{ value: "America/New_York" }, { value: "America/Chicago" }]
    expect(pickTimezone(zones, "America/Chicago")).toBe("America/Chicago")
  })
  it("changes nothing while the list is empty", () => {
    expect(pickTimezone([], "UTC")).toBe("UTC")
  })
})
