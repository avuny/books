"use client"

import * as React from "react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@workspace/ui/components/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"
import { cn } from "@workspace/ui/lib/utils"

import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "./icons.js"
import { getInitials } from "./nav-utils.js"

export type Workspace = {
  id: string
  name: string
  /** Secondary line, e.g. the plan name. */
  description?: string
  /** Any node (image, icon, emoji). Falls back to the name's initials. */
  logo?: React.ReactNode
}

export type WorkspaceSwitcherLabels = {
  switchWorkspace: string
  searchPlaceholder: string
  empty: string
  create: string
}

const defaultLabels: WorkspaceSwitcherLabels = {
  switchWorkspace: "Switch workspace",
  searchPlaceholder: "Search workspaces…",
  empty: "No workspace found.",
  create: "Create workspace",
}

export type WorkspaceSwitcherProps = {
  workspaces: readonly Workspace[]
  activeId: string
  onSelect: (id: string) => void
  /** Shows a "create" row when provided. */
  onCreate?: () => void
  /** Translate the built-in strings. */
  labels?: Partial<WorkspaceSwitcherLabels>
}

function WorkspaceLogo({
  workspace,
  className,
}: {
  workspace: Workspace
  className?: string
}) {
  return (
    <span
      className={cn(
        "flex aspect-square shrink-0 items-center justify-center overflow-hidden text-xs font-semibold",
        className
      )}
    >
      {workspace.logo ?? getInitials(workspace.name)}
    </span>
  )
}

export function WorkspaceSwitcher({
  workspaces,
  activeId,
  onSelect,
  onCreate,
  labels,
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = React.useState(false)
  const text = { ...defaultLabels, ...labels }
  const active =
    workspaces.find((workspace) => workspace.id === activeId) ?? workspaces[0]
  if (!active) return null

  const choose = (action: () => void) => () => {
    action()
    setOpen(false)
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <SidebarMenuButton size="lg">
                <WorkspaceLogo
                  workspace={active}
                  className="size-8 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
                />
                <span className="grid min-w-0 flex-1 text-start text-sm leading-tight">
                  <span className="truncate font-medium">{active.name}</span>
                  {active.description ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {active.description}
                    </span>
                  ) : null}
                </span>
                <span className="sr-only">{text.switchWorkspace}</span>
                <ChevronsUpDownIcon className="ms-auto" />
              </SidebarMenuButton>
            }
          />
          <PopoverContent
            align="start"
            className="w-(--radix-popover-trigger-width) min-w-60 p-0"
          >
            <Command>
              <CommandInput placeholder={text.searchPlaceholder} />
              <CommandList>
                <CommandEmpty>{text.empty}</CommandEmpty>
                <CommandGroup>
                  {workspaces.map((workspace) => (
                    <CommandItem
                      key={workspace.id}
                      value={workspace.name}
                      onSelect={choose(() => onSelect(workspace.id))}
                    >
                      <WorkspaceLogo
                        workspace={workspace}
                        className="size-6 rounded-md bg-muted text-muted-foreground"
                      />
                      <span className="truncate">{workspace.name}</span>
                      {workspace.id === active.id ? (
                        <CheckIcon className="ms-auto" />
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
                {onCreate ? (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem onSelect={choose(onCreate)}>
                        <PlusIcon />
                        {text.create}
                      </CommandItem>
                    </CommandGroup>
                  </>
                ) : null}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
