import { useEffect, useState } from "react"

const secondsUntil = (iso: string | null) =>
  iso ? Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 1000)) : 0

export function useCountdown(targetIso: string | null) {
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(targetIso))

  useEffect(() => {
    setSecondsLeft(secondsUntil(targetIso))
    if (!targetIso) return
    const id = window.setInterval(() => {
      const next = secondsUntil(targetIso)
      setSecondsLeft(next)
      if (next <= 0) window.clearInterval(id)
    }, 1000)
    return () => window.clearInterval(id)
  }, [targetIso])

  return secondsLeft
}
