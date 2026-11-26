import { useSyncExternalStore } from "react"

// Ticks four times a second, but React only re-renders when the whole-second
// value returned by the snapshot actually changes.
function subscribe(onTick: () => void) {
  const id = window.setInterval(onTick, 250)
  return () => window.clearInterval(id)
}

function secondsUntil(targetMs: number) {
  const diff = targetMs - Date.now()
  return Number.isFinite(diff) ? Math.max(0, Math.ceil(diff / 1000)) : 0
}

/** Whole seconds left until `target`. 0 once it has passed. */
export function useCountdown(target: string | number | Date): number {
  const targetMs = new Date(target).getTime()

  return useSyncExternalStore(
    subscribe,
    () => secondsUntil(targetMs),
    () => 0
  )
}
