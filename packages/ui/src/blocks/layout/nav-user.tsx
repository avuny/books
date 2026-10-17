"use client";

import { ChevronsUpDown, UserIcon } from "lucide-react";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";

import { Button } from "@workspace/ui/components/button";
import {
  UserDropdownMenu,
  UserDropdownMenuProps,
} from "@workspace/ui/blocks/layout/user-dropdown";

// type MenuSection = {
//   enabled?: boolean;
//   label?: string;
//   onClick?: () => void;
// };

type NavUserProps = {
  iconOnly?: boolean;
} & Omit<UserDropdownMenuProps, "dropdownMenuTrigger">;

export function UserNav({ iconOnly, ...props }: NavUserProps) {
  return iconOnly ? (
    <UserDropdownMenu
      {...props}
      dropdownMenuTrigger={
        <Button variant="outline" size="icon" className="cursor-pointer">
          <UserIcon />
        </Button>
      }
    />
  ) : (
    <SidebarMenu>
      <SidebarMenuItem>
        <UserDropdownMenu
          {...props}
          dropdownMenuTrigger={
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="inline-flex items-center justify-center rounded-md border h-10 w-10">
                <AvatarImage src={props.user.avatar} alt={props.user.name} />
                <AvatarFallback className="rounded-lg">
                  <UserIcon />
                </AvatarFallback>
              </Avatar>

              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {props.user.name}
                </span>
                <span className="truncate text-xs">
                  {props.user.identifier}
                </span>
              </div>

              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          }
        />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
