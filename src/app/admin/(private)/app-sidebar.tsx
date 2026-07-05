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
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth/auth-client";
import {
  Settings,
  CalendarFold,
  SquareDashedText,
  Star,
  CalendarSync,
  ArrowUpToLine,
  ArrowDownToLine,
  ImageIcon,
  MapPin,
  Form,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

export function AppSidebar() {
  const router = useRouter();
  const [isLoggingOut, startLogoutTransition] = useTransition();
  const { setOpenMobile } = useSidebar();

  const currentPath = usePathname();
  const closeMobileSidebar = () => setOpenMobile(false);

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
                  <Link href="/admin" onClick={closeMobileSidebar}>
                    <Form />
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
                  <Link href="/admin/content" onClick={closeMobileSidebar}>
                    <SquareDashedText />
                    Inhoud
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
                  <Link href="/admin/reviews" onClick={closeMobileSidebar}>
                    <Star />
                    Beoordelingen
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  variant={
                    currentPath === "/admin/gallery" ? "outline" : "default"
                  }
                  asChild
                >
                  <Link href="/admin/gallery" onClick={closeMobileSidebar}>
                    <ImageIcon />
                    Galerij
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  variant={
                    currentPath === "/admin/pois" ? "outline" : "default"
                  }
                  asChild
                >
                  <Link href="/admin/pois" onClick={closeMobileSidebar}>
                    <MapPin />
                    POI&apos;s
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
                  <Link href="/admin/bookings" onClick={closeMobileSidebar}>
                    <CalendarFold />
                    Boekingen
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  variant={
                    currentPath === "/admin/settings" ? "outline" : "default"
                  }
                  asChild
                >
                  <Link href="/admin/settings" onClick={closeMobileSidebar}>
                    <Settings />
                    Instellingen
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
                  <Link href="/admin/ical/import" onClick={closeMobileSidebar}>
                    <ArrowDownToLine />
                    Importeren
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
                  <Link href="/admin/ical/export" onClick={closeMobileSidebar}>
                    <ArrowUpToLine />
                    Exporteren
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
              {isLoggingOut ? "Uitloggen..." : "Uitloggen"}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
