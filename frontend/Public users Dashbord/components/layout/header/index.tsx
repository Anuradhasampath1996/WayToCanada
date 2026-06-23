"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

import { Separator } from "@/components/ui/separator";
import Notifications from "@/components/layout/header/notifications";
import Search from "@/components/layout/header/search";
import ThemeSwitch from "@/components/layout/header/theme-switch";
import UserMenu from "@/components/layout/header/user-menu";
import { ThemeCustomizerPanel } from "@/components/theme-customizer";
import { useSidebar } from "@/components/ui/sidebar";

export function SiteHeader() {
  const { toggleSidebar, open } = useSidebar();

  return (
    <header className="bg-background sticky top-0 z-50 flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex min-w-0 w-full items-center gap-1 px-3 sm:px-4 lg:gap-2">
        <Button onClick={toggleSidebar} size="icon" variant="ghost" className="shrink-0">
          {open ? <PanelLeftClose /> : <PanelLeftOpen />}
        </Button>
        <Separator orientation="vertical" className="mx-1 hidden sm:block data-[orientation=vertical]:h-4" />
        <div className="min-w-0 flex-1">
          <Search />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <Notifications />
          <ThemeSwitch />
          <div className="hidden md:block">
            <ThemeCustomizerPanel />
          </div>
          <Separator orientation="vertical" className="mx-1 hidden sm:block data-[orientation=vertical]:h-4" />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
