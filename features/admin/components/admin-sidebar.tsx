"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowLeftIcon,
  ChevronsUpDownIcon,
  LogOutIcon,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import { ThemeMenuGroup } from "@/components/theme-switcher"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useLogout } from "@/features/auth/hooks/use-logout"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import {
  adminFooterItems,
  adminNavSections,
  type AdminNavItem,
} from "@/features/admin/data/nav-items"

/**
 * Admin navigation, modelled on Meta Business Suite: brand on top, the main
 * tools in labelled sections in the middle, settings and the account at the
 * bottom. Collapses to icons on desktop and becomes a sheet on phones.
 */
export function AdminSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <BrandButton />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {adminNavSections.map(({ label, items }) => (
            <SidebarGroupContent key={label}>
              <SidebarGroupLabel render={<h2 />}>{label}</SidebarGroupLabel>
              <NavMenu items={items} label={label} />
            </SidebarGroupContent>
          ))}
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavMenu items={adminFooterItems} label="Hỗ trợ" />
        <AccountMenu />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

function BrandButton() {
  const { setOpenMobile } = useSidebar()

  return (
    <SidebarMenu className="group-data-[collapsible=icon]:hidden">
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          render={<Link href="/admin" onClick={() => setOpenMobile(false)} />}
          aria-label="Trang tổng quan quản trị Vedora"
        >
          <span className="grid leading-none">
            <span className="text-xl font-extrabold tracking-[-0.04em]">
              Vedora
            </span>
            <span className="mt-1 text-xs font-medium text-muted-foreground">
              Quản trị
            </span>
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function NavMenu({ items, label }: { items: AdminNavItem[]; label: string }) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()

  return (
    <nav aria-label={label}>
      <SidebarMenu>
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/admin"
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`)
          return (
            <SidebarMenuItem key={href}>
              <SidebarMenuButton
                isActive={active}
                tooltip={label}
                variant="brand"
                size="nav"
                render={
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpenMobile(false)}
                  />
                }
              >
                <Icon aria-hidden strokeWidth={active ? 2.25 : 1.75} />
                <span>{label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </nav>
  )
}

function AccountMenu() {
  const { author } = useAuth()
  const { logout, pending } = useLogout()
  const { isMobile } = useSidebar()
  if (!author) return null

  return (
    <>
      <SidebarSeparator className="mx-0" />
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<SidebarMenuButton size="lg" />}
              aria-label={`Menu tài khoản của ${author.name}`}
            >
              <AuthorAvatar author={author} size="sm" className="size-8" />
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold">
                  {author.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  @{author.handle}
                </span>
              </span>
              <ChevronsUpDownIcon aria-hidden className="ml-auto text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side={isMobile ? "top" : "right"}
              align="end"
              className="w-60"
            >
              <ThemeMenuGroup />
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/home" />}>
                <ArrowLeftIcon aria-hidden />
                Về trang chính
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout} disabled={pending}>
                <LogOutIcon aria-hidden />
                Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  )
}
