import { loadTestEnv } from "./env.js"

// Vitest `setupFiles` entry: runs in every worker before the test file imports the app.
loadTestEnv()
