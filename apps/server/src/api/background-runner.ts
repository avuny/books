import type { Context } from "hono"
import { config } from "./config.js"

/**
 * BackgroundRunner port (D9): fire-and-forget a task after the response has been sent.
 *
 * Three adapters, chosen by BACKGROUND_RUNNER:
 *  - "waituntil" — serverless (Cloudflare Workers, Vercel). Passes the promise to
 *    `ctx.executionCtx.waitUntil` so the runtime keeps it alive after the response.
 *  - "node"      — Node.js. Schedules the task on the next tick and lets it run.
 *    Any uncaught rejection is logged.
 *  - "inline"    — Tests only. Awaits the task synchronously (refused in production,
 *    because it brings back the D9 timing leak that waitUntil / node prevent).
 */
export type BackgroundTask = () => Promise<void>

/**
 * Schedule a background task. The task runs after the response is sent.
 * Pass the Hono context so waituntil can access executionCtx.
 */
export function scheduleBackground(task: BackgroundTask, c?: Context): void {
  const runner = config.BACKGROUND_RUNNER

  if (runner === "waituntil") {
    // Cloudflare Workers / Vercel edge: keep the process alive for this promise.
    const executionCtx = (c as unknown as { executionCtx?: { waitUntil: (p: Promise<unknown>) => void } } | undefined)
      ?.executionCtx
    if (executionCtx?.waitUntil) {
      executionCtx.waitUntil(task())
    } else {
      // Fallback: schedule via setImmediate if executionCtx is unavailable.
      setImmediate(() => {
        task().catch(console.error)
      })
    }
    return
  }

  if (runner === "node") {
    // Node.js: fire and forget on the next tick.
    setImmediate(() => {
      task().catch(console.error)
    })
    return
  }

  // "inline" — synchronous, for tests. Refused in production by config validation.
  // We still need to schedule it; callers treat scheduleBackground as void.
  // Use a micro-task so the timing difference from node/waituntil is minimal in tests.
  Promise.resolve().then(task).catch(console.error)
}
