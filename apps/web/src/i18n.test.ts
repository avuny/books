import { describe, expect, it } from "vitest"
import i18n from "./i18n"

describe("i18n", () => {
  it("translates nested keys in default namespace properly", async () => {
    await i18n.changeLanguage("en")
    expect(i18n.t("msgs.confirmDeleteDescription")).toBe(
      "This action cannot be undone. This will permanently delete this item."
    )
  })

  it("translates in arabic", async () => {
    await i18n.changeLanguage("ar")
    expect(i18n.t("msgs.confirmDeleteDescription")).toBe(
      "لا يمكن التراجع عن هذا الإجراء. سيتم حذف هذا العنصر نهائيًا."
    )
  })
})
