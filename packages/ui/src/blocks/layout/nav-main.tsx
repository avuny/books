"use client"

import { ChevronRight } from "lucide-react"
import * as React from "react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@workspace/ui/components/sidebar"

import { cn } from "@workspace/ui/lib/utils"

type SubItem = {
  label: string
  path: string
  name: string
}

type Item = {
  label: string
  icon?: React.JSX.Element
  isActive?: boolean
  options?: SubItem[]
}

export function NavMain({
  items,
  onSubItemClick,
  isSubItemActive,
  isItemActive,
}: {
  items: Item[]
  isItemActive?: (item: Item) => boolean
  onSubItemClick?: (subItem: SubItem) => void
  isSubItemActive?: (subItem: SubItem) => boolean
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
        Workspace
      </SidebarGroupLabel>

      <SidebarMenu>
        {items.map((item) => {
          const isActive = isItemActive?.(item) || item.isActive

          return (
            <Collapsible
              key={item.label}
              defaultOpen={isActive}
              className="group/collapsible"
              render={<SidebarMenuItem />}
            >
              <CollapsibleTrigger
                render={
                  <SidebarMenuButton
                    tooltip={item.label}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 text-sm font-medium transition-colors",
                      "hover:bg-muted",
                      isActive && "bg-muted"
                    )}
                  />
                }
              >
                {item.icon && (
                  <span className="text-muted-foreground">{item.icon}</span>
                )}

                <span>{item.label}</span>

                {item.options && (
                  <ChevronRight className="ms-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                )}
              </CollapsibleTrigger>

              {item.options && (
                <CollapsibleContent>
                  <SidebarMenuSub className="mt-1 ml-3 border-l pl-3">
                    {item.options.map((subItem) => {
                      const active = isSubItemActive?.(subItem)

                      return (
                        <SidebarMenuSubItem key={subItem.label}>
                          <SidebarMenuSubButton
                            onClick={() => onSubItemClick?.(subItem)}
                            className={cn(
                              "w-full cursor-pointer text-left text-sm transition-colors",
                              "text-muted-foreground hover:bg-muted hover:text-foreground",
                              active &&
                                "border-e-2 border-primary bg-muted font-medium text-foreground"
                            )}
                          >
                            {subItem.label}
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              )}
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
