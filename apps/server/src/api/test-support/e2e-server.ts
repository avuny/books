import { loadTestEnv } from "./env.js"

// Starts the real API server against the test database for the Playwright run:
//   pnpm --filter @avuny/books-server test:e2e-server
// PORT and MESSAGE_OUTBOX_FILE come from the Playwright config.
loadTestEnv()
await import("../../node-server.js")
