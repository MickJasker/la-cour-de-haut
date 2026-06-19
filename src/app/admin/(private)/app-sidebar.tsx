"use client";

import { Logo } from "@/components/ui/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import {
  Settings,
  CalendarFold,
  SquareDashedText,
  Star,
  CalendarSync,
  ArrowUpToLine,
  ArrowDownToLine,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

export function AppSidebar() {
  const router = useRouter();
  const [isLoggingOut, startLogoutTransition] = useTransition();

  const currentPath = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="flex items-center justify-center p-5">
        <Logo />
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  variant={currentPath === "/admin" ? "outline" : "default"}
                  asChild
                >
                  <Link href="/admin">
                    <SquareDashedText />
                    Dashboard
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  variant={
                    currentPath === "/admin/content" ? "outline" : "default"
                  }
                  asChild
                >
                  <Link href="/admin/content">
                    <SquareDashedText />
                    Content
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  variant={
                    currentPath === "/admin/reviews" ? "outline" : "default"
                  }
                  asChild
                >
                  <Link href="/admin/reviews">
                    <Star />
                    Reviews
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  variant={
                    currentPath === "/admin/bookings" ? "outline" : "default"
                  }
                  asChild
                >
                  <Link href="/admin/bookings">
                    <CalendarFold />
                    Bookings
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  variant={
                    currentPath === "/admin/settings" ? "outline" : "default"
                  }
                  asChild
                >
                  <Link href="/admin/settings">
                    <Settings />
                    Settings
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <CalendarSync /> ICAL
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  variant={
                    currentPath === "/admin/ical/import" ? "outline" : "default"
                  }
                  asChild
                >
                  <Link href="/admin/ical/import">
                    <ArrowDownToLine />
                    Import
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  variant={
                    currentPath === "/admin/ical/export" ? "outline" : "default"
                  }
                  asChild
                >
                  <Link href="/admin/ical/export">
                    <ArrowUpToLine />
                    Export
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                startLogoutTransition(async () => {
                  await authClient.signOut();
                  router.push("/admin/login");
                });
              }}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? "Signing out..." : "Sign out"}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
