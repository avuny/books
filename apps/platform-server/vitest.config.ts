import { defineConfig } from "vitest/config"

// Two projects, two commands (same layout as apps/server):
//   pnpm test      -> unit: fakes, no database, no network
//   pnpm test:int  -> integration: a real test database (see src/api/test-support)
export default defineConfig({
  test: {
    // Platform roles/admins are global singletons and integration tests own whole
    // tables, so files must not run concurrently against the one test database.
    // This is a run-level (root) option: project-level fileParallelism is ignored.
    fileParallelism: false,
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/*.{test,spec}.ts"],
          exclude: ["src/**/*.int.test.ts", "**/node_modules/**"],
        },
      },
      {
        test: {
          name: "integration",
          include: ["src/**/*.int.test.ts"],
          globalSetup: ["./src/api/test-support/global-setup.ts"],
          setupFiles: ["./src/api/test-support/setup-env.ts"],
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
})
