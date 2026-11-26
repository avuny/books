import { defineConfig, devices } from "@playwright/test"
import {
  API_PORT,
  API_URL,
  OUTBOX_FILE,
  REPO_ROOT,
  SERVER_PACKAGE,
  WEB_PORT,
  WEB_URL,
} from "./e2e/support/env.ts"

const server = `pnpm --filter ${SERVER_PACKAGE}`

export default defineConfig({
  testDir: "./e2e/specs",
  testMatch: "**/*.e2e.ts", // not *.spec.ts: web's vitest would pick those up
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: true, // every test registers its own user, so tests never share rows
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: WEB_URL,
    locale: "en-US", // specs read English copy from the contracts locale files
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: [
    {
      // 1) rebuild the test database (drop -> migrate -> seed), 2) start the REAL API on it.
      command: `${server} test:db:reset && ${server} test:e2e-server`,
      cwd: REPO_ROOT,
      url: `${API_URL}/api/health`,
      timeout: 300_000,
      reuseExistingServer: false, // a stale server could be pointed at the wrong database
      stdout: "pipe",
      stderr: "pipe",
      env: {
        PORT: String(API_PORT),
        CORS_ORIGINS: WEB_URL,
        MESSAGE_OUTBOX_FILE: OUTBOX_FILE,
        // Every browser and API call comes from 127.0.0.1, so lift the per-IP throttles.
        OTP_MAX_SENDS_PER_IP_PER_HOUR: "10000",
        SIGNIN_MAX_FAILURES_PER_IP: "10000",
      },
    },
    {
      command: `pnpm --filter @avuny/books-web exec vite --port ${WEB_PORT} --strictPort`,
      cwd: REPO_ROOT,
      url: WEB_URL,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
      env: { VITE_API_URL: API_URL },
    },
  ],
})
