"use client"

import { Kbd } from "@workspace/ui/components/kbd"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

import { SearchIcon } from "./icons.js"

export type SidebarSearchTriggerProps = {
  /** Open your command palette here. The block never owns the palette. */
  onOpen: () => void
  placeholder?: string
  /** Display-only hint. Bind the real shortcut in your palette. */
  shortcut?: string
}

export function SidebarSearchTrigger({
  onOpen,
  placeholder = "Search…",
  shortcut = "⌘K",
}: SidebarSearchTriggerProps) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          variant="outline"
          tooltip={placeholder}
          onClick={onOpen}
          className="text-muted-foreground"
        >
          <SearchIcon />
          <span className="truncate">{placeholder}</span>
          <Kbd dir="ltr" className="ms-auto">
            {shortcut}
          </Kbd>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
