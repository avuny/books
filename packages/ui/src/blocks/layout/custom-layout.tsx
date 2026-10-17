"use client";
import { ReactNode, useEffect, useState } from "react";

import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar";
import {
  AppSidebar,
  AppSidebarProps,
} from "@workspace/ui/blocks/layout/app-sidebar";
import { Navbar, NavbarProps } from "@workspace/ui/blocks/layout/navbar";
import LoadingPage from "@workspace/ui/blocks/loading/loading-page";

export type CustomLayoutProps = {
  children: ReactNode;
} & AppSidebarProps &
  NavbarProps;

export const CustomLayout = ({
  children,
  start,
  end,
  rtl = false,
  ...rest
}: CustomLayoutProps) => {
  const [mounted, setMounted] = useState(false);

  // Delay rendering until after the component mounts to prevent hydration mismatch.
  // This layout relies on `rtl`, which may depend on client-only state (e.g., localStorage or user preferences).
  // Rendering conditionally based on such values can cause the server-rendered HTML to differ from the client,
  // leading to hydration errors. By deferring rendering until after mount, we ensure consistent client-only rendering.
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <LoadingPage />;
  }

  //////////////////////////////
  const Page = (
    <SidebarInset>
      <Navbar
        start={
          <>
            <SidebarTrigger className="-ml-1" />
            {start}
          </>
        }
        end={end}
      />
      <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
    </SidebarInset>
  );

  return (
    <SidebarProvider>
      <AppSidebar {...rest} side={rtl ? "right" : "left"} />
      {Page}
    </SidebarProvider>
  );
};
