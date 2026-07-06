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
  ArrowUpToLine,
  ArrowDownToLine,
  ImageIcon,
  MapPin,
  Form,
  FileText,
  Files,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type NavGroup = {
  label?: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ href: "/admin", label: "Dashboard", icon: Form }],
  },
  {
    label: "Verhuur",
    items: [
      { href: "/admin/bookings", label: "Boekingen", icon: CalendarFold },
      {
        href: "/admin/ical/import",
        label: "iCal importeren",
        icon: ArrowDownToLine,
      },
      {
        href: "/admin/ical/export",
        label: "iCal exporteren",
        icon: ArrowUpToLine,
      },
    ],
  },
  {
    label: "Website",
    items: [
      { href: "/admin/content", label: "Inhoud", icon: SquareDashedText },
      { href: "/admin/gallery", label: "Galerij", icon: ImageIcon },
      { href: "/admin/reviews", label: "Beoordelingen", icon: Star },
      { href: "/admin/pois", label: "POI's", icon: MapPin },
      { href: "/admin/pages", label: "Pagina's", icon: Files },
      { href: "/admin/documents", label: "Documenten", icon: FileText },
    ],
  },
  {
    label: "Systeem",
    items: [{ href: "/admin/settings", label: "Instellingen", icon: Settings }],
  },
];

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
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label ?? "root"}>
            {group.label && (
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      variant={
                        currentPath === item.href ? "outline" : "default"
                      }
                      asChild
                    >
                      <Link href={item.href} onClick={closeMobileSidebar}>
                        <item.icon />
                        {item.label}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
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
