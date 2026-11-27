"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeftIcon, LogOutIcon, MoreHorizontalIcon, SunMoonIcon } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  SidebarMenuBadge,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { ThemeMenuGroup } from "@/components/theme-switcher"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useLogout } from "@/features/auth/hooks/use-logout"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { Logo } from "@/features/shared/components/wordmark"
import {
  ADMIN_HOME,
  adminNavItems,
  adminNavSections,
  isAdminNavActive,
  type AdminNavItem,
} from "@/features/admin/data/nav-items"
import { useAdminWorkQueue } from "@/features/admin/overview/work-queue-provider"

export function AdminSidebar() {
  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <div className="flex items-center gap-1">
          <BrandLink />
          <SidebarTrigger className="ml-auto" aria-label="Thu gọn thanh bên" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <NavMenu items={adminNavItems} label="Chung" />
        </SidebarGroup>

        {adminNavSections.map(({ label, items }) => (
          <SidebarGroup key={label}>
            <SidebarGroupLabel render={<h2 />}>{label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <NavMenu items={items} label={label} />
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <nav aria-label="Hỗ trợ">
          <SidebarMenu>
            <ThemeMenu />
          </SidebarMenu>
        </nav>
        <SidebarSeparator />
        <AccountMenu />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

function BrandLink() {
  const { setOpenMobile } = useSidebar()

  return (
    <Link
      href={ADMIN_HOME}
      onClick={() => setOpenMobile(false)}
      aria-label="Vedora Quản trị"
      className="flex min-w-0 items-center gap-2 rounded-xl px-1 py-0.5 outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring"
    >
      <Logo className="h-6" />
      <span className="truncate text-sm font-semibold">Quản trị</span>
    </Link>
  )
}

function NavMenu({ items, label }: { items: AdminNavItem[]; label: string }) {
  return (
    <nav aria-label={label}>
      <SidebarMenu>
        <NavItems items={items} />
      </SidebarMenu>
    </nav>
  )
}

function NavItems({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  const queue = useAdminWorkQueue()

  return items.map(({ href, label, icon: Icon, workBadge, workCount }) => {
    const active = isAdminNavActive(href, pathname)
    const count = queue.error
      ? undefined
      : workBadge
        ? queue.data?.badges[workBadge]
        : workCount
          ? queue.data?.counts[workCount]
          : undefined
    return (
      <SidebarMenuItem key={href}>
        <SidebarMenuButton
          isActive={active}
          render={
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={count ? `${label}, ${count} việc chưa xử lý` : label}
              onClick={() => setOpenMobile(false)}
            />
          }
        >
          <Icon aria-hidden />
          <span>{label}</span>
        </SidebarMenuButton>
        {(workBadge || workCount) && queue.error ? (
          <SidebarMenuBadge
            aria-label={`${label}: chưa tải được số việc`}
            title="Chưa tải được số việc"
          >
            !
          </SidebarMenuBadge>
        ) : count ? (
          <SidebarMenuBadge aria-hidden="true" title={`${count} việc chưa xử lý`}>
            {count > 99 ? "99+" : count}
          </SidebarMenuBadge>
        ) : null}
      </SidebarMenuItem>
    )
  })
}

function ThemeMenu() {
  const { isMobile } = useSidebar()

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger render={<SidebarMenuButton />}>
          <SunMoonIcon aria-hidden />
          <span>Giao diện</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side={isMobile ? "top" : "right"} align="end" className="w-52">
          <ThemeMenuGroup />
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}

function AccountMenu() {
  const { author } = useAuth()
  const { logout, pending } = useLogout()
  const { isMobile } = useSidebar()
  if (!author) return null

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton variant="outline" className="h-10" />}
            aria-label={`Menu tài khoản của ${author.name}`}
          >
            <AuthorAvatar author={author} size="sm" />
            <span className="min-w-0 flex-1 truncate font-medium">{author.name}</span>
            <MoreHorizontalIcon aria-hidden className="text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side={isMobile ? "top" : "right"} align="end" className="w-56">
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
  )
}
