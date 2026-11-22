import { expect, test } from "../fixtures.ts"
import { listOrganizations, uniqueId } from "../support/api.ts"
import { copy } from "../support/copy.ts"

const t = copy("organization")

test.describe("organizations (real browser, real API, real database)", () => {
  test("a signed-in user creates an organization from the form", async ({
    signedInPage: page,
    account,
    request,
  }) => {
    const id = uniqueId()
    const code = `e2e-${id}`

    await page.goto("/organization/create")
    await page.getByLabel(t("create.name.label")).fill(`E2E Org ${id}`)
    await page.getByLabel(t("create.code.label")).fill(code)

    // Selects list only what the test database was seeded with (USD, EGP / UTC, Africa/Cairo).
    await page.getByLabel(t("create.defaultCurrency.label")).click()
    await page.getByRole("option", { name: /USD/ }).click()
    await page.getByLabel(t("create.timezone.label")).click()
    await page.getByRole("option", { name: /UTC/ }).first().click()

    await page.getByLabel(t("create.ownerUsername.label")).fill(`owner-${id}`)
    await page
      .locator("form")
      .getByRole("button", { name: t("create.submitLabel") })
      .click()

    // The UI's side effect is verified through the API, so the test does not depend on where
    // the app navigates afterwards.
    await expect
      .poll(async () =>
        (await listOrganizations(request, account)).map((o) => o.code)
      )
      .toContain(code)
  })
})
