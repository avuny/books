"use client"

import { ModeToggle } from "@workspace/ui/blocks/settings/mode-toggle"
import { useTheme } from "@workspace/ui/providers/theme-provider"

export default function ModeSwitcherBtn() {
  const { theme, setTheme } = useTheme()

  return <ModeToggle theme={theme} setTheme={setTheme} />
}
