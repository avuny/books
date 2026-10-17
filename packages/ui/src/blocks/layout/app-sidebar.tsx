import { ReactNode } from "react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
} from "@workspace/ui/components/sidebar";

export type AppSidebarProps = {
  collapsible?: "offcanvas" | "icon" | "none" | undefined;
  sidebarHeader?: ReactNode;
  sidebarContent?: ReactNode;
  sidebarFooter?: ReactNode;
} & React.ComponentProps<typeof Sidebar>; // To inherit all other Sidebar props

export function AppSidebar({
  collapsible,
  sidebarHeader,
  sidebarContent,
  sidebarFooter,
  ...rest
}: AppSidebarProps) {
  return (
    <Sidebar collapsible={collapsible} {...rest}>
      {sidebarHeader && <SidebarHeader>{sidebarHeader}</SidebarHeader>}
      {sidebarContent && <SidebarContent>{sidebarContent}</SidebarContent>}
      {sidebarFooter && <SidebarFooter>{sidebarFooter}</SidebarFooter>}
      <SidebarRail />
    </Sidebar>
  );
}
