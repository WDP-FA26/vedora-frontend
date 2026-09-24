"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { EllipsisIcon, LogOutIcon, SettingsIcon, PenLineIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeMenuGroup } from "@/components/theme-switcher"
import { PetMenuGroup } from "./nutrition-pet"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { ComposeDialog } from "@/features/shared/components/compose-dialog"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useLogout } from "@/features/auth/hooks/use-logout"
import { navItems } from "@/features/shared/data/nav-items"
import { Wordmark } from "./wordmark"

/**
 * Desktop and tablet navigation. Icon-only below `xl`, full labels above,
 * mirroring X's collapsing left column.
 */
export function LeftNav() {
  return (
    <header className="sticky top-0 hidden h-dvh w-[4.5rem] shrink-0 flex-col items-center px-2 py-4 sm:flex xl:w-[16.25rem] xl:items-stretch xl:px-4">
      <Wordmark compact className="xl:hidden" />
      <Wordmark className="px-2 max-xl:hidden" />

      <NavLinks className="mt-7" />

      <ComposeDialog
        trigger={
          <Button variant="raised" size="compose" shape="pill" className="mt-6">
            <PenLineIcon aria-hidden strokeWidth={2.25} />
            <span className="max-xl:sr-only">Đăng bài</span>
          </Button>
        }
      />

      <div className="mt-auto">
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
  /** Always show labels, regardless of breakpoint (mobile sheet). */
  expanded?: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()

  return (
    <nav aria-label="Điều hướng chính" className={className}>
      <ul className="flex flex-col gap-1">
        {navItems.map(({ href, label, icon: Icon, isNew }) => {
          const current = pathname === href
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "group/nav flex h-12 items-center gap-4 rounded-full text-[0.9375rem] font-medium text-foreground/85 transition-colors outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50",
                  "aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-bold aria-[current=page]:text-foreground",
                  expanded
                    ? "px-3"
                    : "w-12 justify-center xl:w-full xl:justify-start xl:px-3"
                )}
              >
                <span className="relative">
                  <Icon
                    aria-hidden
                    className="size-[1.375rem] group-aria-[current=page]/nav:text-primary"
                    strokeWidth={current ? 2.25 : 1.75}
                  />
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

function AccountMenu() {
  const { author } = useAuth()
  const { logout, pending } = useLogout()
  if (!author) return null

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
            @{author.handle}
          </span>
        </span>
        <EllipsisIcon aria-hidden className="size-4 text-muted-foreground max-xl:hidden" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        <ThemeMenuGroup />
        <DropdownMenuSeparator />
        <PetMenuGroup />
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/home/settings" />}>
          <SettingsIcon aria-hidden />
          Cài đặt
        </DropdownMenuItem>
        <DropdownMenuItem onClick={logout} disabled={pending}>
          <LogOutIcon aria-hidden />
          Đăng xuất @{author.handle}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
