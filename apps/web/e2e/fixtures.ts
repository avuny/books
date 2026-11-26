import { test as base, expect, type Page } from "@playwright/test"
import { registerAccount, type Account } from "./support/api.ts"

interface Fixtures {
  /** A user registered through the real API, fresh for this test. */
  account: Account
  /** A page that already belongs to `account`, like a returning visitor with a live session. */
  signedInPage: Page
}

// The fixture callback's second argument is called `provide` (not Playwright's usual `use`)
// because eslint-plugin-react-hooks treats any `use(...)` call as a React hook.
export const test = base.extend<Fixtures>({
  account: async ({ context }, provide) => {
    await provide(await registerAccount(context.request))
  },

  signedInPage: async ({ page, account }, provide) => {
    // Same key the app's tokenStorage uses (apps/web/src/mutator/auth/token-storage.ts).
    await page.addInitScript(
      (token) => localStorage.setItem("accessToken", token),
      account.accessToken
    )
    await provide(page)
  },
})

export { expect }
