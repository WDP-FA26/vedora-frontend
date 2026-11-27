"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowLeftRightIcon,
  EllipsisIcon,
  LogOutIcon,
  PenLineIcon,
  StoreIcon,
  UndoIcon,
} from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeMenuGroup } from "@/components/theme-switcher"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { ComposeDialog } from "@/features/shared/components/compose-dialog"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { profilePath } from "@/features/profiles/profiles-cache"
import { useLogout } from "@/features/auth/hooks/use-logout"
import { useUnreadCount } from "@/features/notifications/hooks/use-notifications"
import { navItems } from "@/features/shared/data/nav-items"
import { Wordmark } from "./wordmark"
import { useMyWorkspaces } from "@/features/workspaces/hooks/use-workspaces"
import { useSwitchAccount } from "@/features/workspaces/hooks/use-switch-account"
import { WORKSPACES_PATH } from "@/features/workspaces/workspaces-cache"
import { UnreadMessagesBadge } from "@/features/messaging/components/unread-messages-badge"

export function LeftNav() {
  return (
    <header className="sticky top-0 hidden h-dvh w-[4.5rem] shrink-0 flex-col items-center px-2 py-3 sm:flex xl:w-[14rem] xl:items-stretch xl:px-4">
      <div className="shrink-0">
        <Wordmark compact className="xl:hidden" />
        <Wordmark className="px-2 max-xl:hidden" />
      </div>

      <div className="-mx-2 mt-3 flex min-h-0 flex-1 flex-col items-center overflow-y-auto overscroll-contain px-2 pb-4 xl:-mx-4 xl:items-stretch xl:px-4">
        <NavLinks />

        <ComposeDialog
          trigger={
            <Button variant="raised" size="compose" shape="pill" className="mt-3 shrink-0">
              <PenLineIcon aria-hidden strokeWidth={2.25} />
              <span className="max-xl:sr-only">Đăng bài</span>
            </Button>
          }
        />
      </div>

      <div className="shrink-0 pt-2">
        <AccountMenu />
      </div>
    </header>
  )
}

export function NavLinks({
  className,
  expanded,
  onNavigate,
}: {
  className?: string
  expanded?: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const { user } = useAuth()
  const unread = useUnreadCount()
  const isAdmin = user?.role === "ADMIN"
  const isPage = user?.accountType === "PAGE"
  const visibleItems = navItems.filter(
    (item) => (!item.adminOnly || isAdmin) && (!item.personalOnly || !isPage)
  )

  return (
    <nav aria-label="Điều hướng chính" className={className}>
      <ul className={cn("flex flex-col", expanded ? "gap-1" : "gap-0.5")}>
        {visibleItems.map(({ href, label, icon: Icon, isNew }) => {
          const current = isNavItemCurrent(pathname, href, user?.id)
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "group/nav flex items-center gap-4 rounded-full text-[0.9375rem] font-medium text-foreground/85 transition-colors outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50",
                  "aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-bold aria-[current=page]:text-foreground",
                  expanded
                    ? "h-11 px-3"
                    : "h-10 w-10 justify-center xl:w-full xl:justify-start xl:px-3"
                )}
              >
                <span className="relative">
                  <Icon
                    aria-hidden
                    className="size-[1.375rem] group-aria-[current=page]/nav:text-primary"
                    strokeWidth={current ? 2.25 : 1.75}
                  />
                  {href === "/home/notifications" && unread > 0 && (
                    <span
                      role="status"
                      aria-label={`${unread} thông báo chưa đọc`}
                      className="absolute -top-1.5 -right-2 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.625rem] leading-4 font-bold text-primary-foreground ring-2 ring-background"
                    >
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                  {href === "/home/messages" && <UnreadMessagesBadge />}
                  {isNew && !expanded && (
                    <span
                      aria-hidden
                      className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary ring-2 ring-background xl:hidden"
                    />
                  )}
                </span>
                <span className={cn(!expanded && "max-xl:sr-only")}>
                  {label}
                </span>
                {isNew && (
                  <span
                    className={cn(
                      "ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[0.6875rem] font-bold text-primary",
                      !expanded && "max-xl:hidden"
                    )}
                  >
                    Mới
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function isNavItemCurrent(pathname: string, href: string, userId?: string) {
  return (
    pathname === href ||
    (href === "/home/profile" &&
      (pathname === "/home/dietary" ||
        (userId !== undefined && pathname === profilePath(userId))))
  )
}

function AccountMenu() {
  const { author, user } = useAuth()
  const { logout, pending } = useLogout()
  if (!author || !user) return null
  const actor = user.actor

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="account" shape="pill" />}
        aria-label={`Menu tài khoản của ${author.name}`}
      >
        <AuthorAvatar author={author} size="lg" />
        <span className="min-w-0 flex-1 leading-tight max-xl:hidden">
          <span className="block truncate text-sm font-bold">
            {author.name}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {actor ? `Trang · bạn là @${actor.username}` : `@${author.handle}`}
          </span>
        </span>
        <EllipsisIcon aria-hidden className="size-4 text-muted-foreground max-xl:hidden" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-64">
        <SwitchAccountGroup currentId={user.id} actorUsername={actor?.username ?? null} />
        <DropdownMenuSeparator />
        <ThemeMenuGroup />
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} disabled={pending}>
          <LogOutIcon aria-hidden />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SwitchAccountGroup({
  currentId,
  actorUsername,
}: {
  currentId: string
  actorUsername: string | null
}) {
  const { workspaces } = useMyWorkspaces()
  const { switchTo, pending } = useSwitchAccount()
  const pages = workspaces.filter(
    (workspace) => workspace.pageUserId !== null && workspace.pageUserId !== currentId
  )

  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Chuyển tài khoản</DropdownMenuLabel>
      {actorUsername && (
        <DropdownMenuItem disabled={pending} onClick={() => switchTo(null, WORKSPACES_PATH)}>
          <UndoIcon aria-hidden />
          Về tài khoản @{actorUsername}
        </DropdownMenuItem>
      )}
      {pages.map((workspace) => (
        <DropdownMenuItem
          key={workspace.id}
          disabled={pending}
          onClick={() => {
            if (workspace.pageUserId) switchTo(workspace.pageUserId, "/home")
          }}
        >
          <ArrowLeftRightIcon aria-hidden />
          <span className="truncate">{workspace.name}</span>
        </DropdownMenuItem>
      ))}
      <DropdownMenuItem render={<Link href={WORKSPACES_PATH} />}>
        <StoreIcon aria-hidden />
        Trang nhà hàng của bạn
      </DropdownMenuItem>
    </DropdownMenuGroup>
  )
}
