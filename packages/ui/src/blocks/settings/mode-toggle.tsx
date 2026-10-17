"use client"

import { MoonIcon, SunIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

type Theme = "dark" | "light" | "system"
type Props = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export function ModeToggle({ theme, setTheme }: Props) {
  const themeList: Theme[] = ["light", "dark", "system"]

  const capitalize = (value: string) =>
    value.charAt(0).toUpperCase() + value.slice(1)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="relative cursor-pointer"
            aria-label="Change theme"
          >
            <SunIcon className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
            <MoonIcon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          </Button>
        }
      />

      <DropdownMenuContent align="end">
        {themeList.map((item) => (
          <DropdownMenuItem
            key={item}
            onClick={() => setTheme(item)}
            className={theme === item ? "bg-accent" : ""}
          >
            {capitalize(item)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
