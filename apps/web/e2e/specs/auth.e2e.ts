import { expect, test } from "../fixtures.ts"
import { TEST_PASSWORD, uniqueId } from "../support/api.ts"
import { copy } from "../support/copy.ts"
import { waitForOtp } from "../support/outbox.ts"

const t = copy("user")

const storedToken = (page: import("@playwright/test").Page) =>
  page.evaluate(() => localStorage.getItem("accessToken"))

test.describe("authentication (real browser, real API, real database)", () => {
  test("a new visitor signs up with the code the API sent", async ({
    page,
  }) => {
    const identifier = `e2e-${uniqueId()}@example.com`

    await page.goto("/auth/sign-up")
    await page
      .getByLabel(t("auth.signUp.sendOtp.identifier.label"))
      .fill(identifier)
    await page
      .getByRole("button", { name: t("auth.signUp.sendOtp.submitLabel") })
      .click()

    // No inbox in e2e: the API's capture sender wrote the code the real flow generated.
    const code = await waitForOtp(identifier)
    const otp = page.getByLabel(t("auth.signUp.verifyOtp.codeLabel"))
    await otp.pressSequentially(code) // the form submits itself once the last digit is typed

    await page
      .getByLabel(t("auth.signUp.completeSignUp.name.label"))
      .fill("E2E New User")
    const passwords = page.locator('input[autocomplete="new-password"]')
    await passwords.nth(0).fill(TEST_PASSWORD)
    await passwords.nth(1).fill(TEST_PASSWORD)
    await page
      .getByRole("button", {
        name: t("auth.signUp.completeSignUp.submitLabel"),
      })
      .click()

    await expect.poll(() => storedToken(page)).toBeTruthy()
    await expect(page).not.toHaveURL(/\/auth\//)
  })

  test("a returning user signs in with email and password", async ({
    page,
    context,
    account,
  }) => {
    // The account fixture registers through the API, which leaves the session cookie on the
    // browser context. Clear cookies so the browser arrives at /auth/sign-in as a clean guest.
    await context.clearCookies()
    await page.goto("/auth/sign-in")
    await page
      .getByLabel(t("auth.signIn.identifier.label"))
      .fill(account.identifier)
    await page
      .locator('input[autocomplete="current-password"]')
      .fill(account.password)
    await page
      .getByRole("button", { name: t("auth.signIn.submitLabel") })
      .click()

    await expect.poll(() => storedToken(page)).toBeTruthy()
    await expect(page).not.toHaveURL(/\/auth\//)
  })

  test("a wrong password is refused with a clear message", async ({
    page,
    context,
    account,
  }) => {
    // Arrive as a clean guest without the registration session.
    await context.clearCookies()
    await page.goto("/auth/sign-in")
    await page
      .getByLabel(t("auth.signIn.identifier.label"))
      .fill(account.identifier)
    await page
      .locator('input[autocomplete="current-password"]')
      .fill("not-the-password-1!")
    await page
      .getByRole("button", { name: t("auth.signIn.submitLabel") })
      .click()

    await expect(page.getByRole("alert")).toBeVisible()
    expect(await storedToken(page)).toBeNull()
  })
})
