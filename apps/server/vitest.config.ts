import { defineConfig } from "vitest/config"

// Two projects, two commands:
//   pnpm test      -> unit: fakes, no database, no network (services, mappers, pure logic)
//   pnpm test:int  -> integration: the real app + a real test database (see src/api/test-support)
export default defineConfig({
  test: {
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
