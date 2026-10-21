"use client"

import HomeButton from "@workspace/ui/blocks/buttons/home-btn"
import ModeSwitcherBtn from "@workspace/ui/blocks/buttons/mode-switcher-btn"
import UserButton, {
  type UserButtonProps,
} from "@workspace/ui/blocks/buttons/user-btn"
import { Navbar } from "@workspace/ui/blocks/layout/navbar"
import LanguageSwitcher, {
  type LanguageSwitcherProps,
} from "@workspace/ui/blocks/settings/langauge-switcher"
import React from "react"

type NavbarContainerProps = {
  children: React.ReactNode
  onHomeClick: () => void
  userButton?: UserButtonProps
} & LanguageSwitcherProps

const NavbarContainer = ({
  children,
  onHomeClick,
  locale,
  label,
  updateLocale,
  userButton,
}: NavbarContainerProps) => {
  return (
    <>
      <Navbar
        start={<HomeButton onClick={onHomeClick} />}
        end={
          <>
            <ModeSwitcherBtn />

            <LanguageSwitcher
              locale={locale}
              label={label}
              updateLocale={updateLocale}
            />

            {userButton && <UserButton {...userButton} />}
          </>
        }
      />

      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-muted p-6 md:p-4">
        {children}
      </div>
    </>
  )
}

export default NavbarContainer
