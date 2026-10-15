import { app } from "./api/index.js"

// Cloudflare Workers entry point: a Hono app exposes `fetch(request, env, ctx)`.
export default app
