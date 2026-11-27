import { app } from "./api/index.js"

export { app } // for openapi spec generation and testing
// Cloudflare Workers entry point: a Hono app exposes `fetch(request, env, ctx)`.
export default app
