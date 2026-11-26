import { loadTestEnv } from "./env.js"
import { ApiClient, type RequestableApp } from "./api-client.js"

export * from "./api-client.js"
export * from "./factories.js"
export { getCaptureOutbox } from "../modules/messaging/index.js"

export interface TestApp {
  /** The real Hono app, exactly as production mounts it (CORS, language, logging, routes). */
  app: RequestableApp
  /** Unauthenticated caller. */
  anonymous: ApiClient
}

/**
 * Boots the real app against the test database. Call it in `beforeAll`. The import is dynamic
 * so the test environment is loaded before `config` is first read.
 */
export async function createTestApp(): Promise<TestApp> {
  loadTestEnv()
  const { app } = await import("../routes.js")
  return { app, anonymous: ApiClient.create(app) }
}
