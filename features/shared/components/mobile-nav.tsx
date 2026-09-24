"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogOutIcon, PlusIcon, SearchIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { ComposeDialog } from "@/features/shared/components/compose-dialog"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useLogout } from "@/features/auth/hooks/use-logout"
import { NavLinks } from "./left-nav"
import { navItems } from "@/features/shared/data/nav-items"
import { Wordmark } from "./wordmark"

/** Phone-only header row: account drawer, mark, search. */
export function MobileTopBar() {
  const [open, setOpen] = useState(false)
  const { author } = useAuth()
  const { logout, pending } = useLogout()

  return (
    <div className="flex h-14 items-center justify-between px-4 sm:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={<Button variant="ghost" size="icon-lg" shape="pill" />}
          aria-label="Mở menu"
        >
          {author && <AuthorAvatar author={author} />}
        </SheetTrigger>
        <SheetContent side="left" className="w-[18rem]">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="p-4">
            {author && (
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <AuthorAvatar author={author} size="lg" />
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-sm font-bold">
                    {author.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    @{author.handle}
                  </span>
                </span>
              </div>
            )}
            <NavLinks expanded className="mt-3" onNavigate={() => setOpen(false)} />
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">
                Giao diện
              </p>
              <ThemeSwitcher />
            </div>
            <button
              type="button"
              onClick={logout}
              disabled={pending}
              className="mt-4 flex h-12 w-full items-center gap-4 rounded-full px-3 text-[0.9375rem] font-medium text-foreground/85 transition-colors outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            >
              <LogOutIcon aria-hidden className="size-[1.375rem]" strokeWidth={1.75} />
              Đăng xuất
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <Wordmark compact className="[&>span]:size-8 [&_svg]:size-4" />

      <Button
        variant="ghost"
        size="icon-lg"
        shape="pill"
        aria-label="Tìm kiếm"
      >
        <SearchIcon aria-hidden className="size-5" />
      </Button>
    </div>
  )
}

/** Phone-only bottom tab bar plus the floating compose button. */
export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <>
      <ComposeDialog
        trigger={
          <Button
            aria-label="Tạo bài viết mới"
            variant="raised"
            size="icon-fab"
            shape="pill"
            className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 sm:hidden"
          >
            <PlusIcon aria-hidden strokeWidth={2.25} />
          </Button>
        }
      />
      <nav
        aria-label="Điều hướng chính"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
      >
        <ul className="flex h-14 items-stretch justify-around">
          {navItems
            .filter((item) => item.href !== "/home/settings")
            .map(({ href, label, icon: Icon }) => {
              const current = pathname === href
              return (
                <li key={href} className="flex flex-1">
                  <Link
                    href={href}
                    aria-label={label}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex flex-1 items-center justify-center text-muted-foreground outline-none focus-visible:bg-accent",
                      current && "text-primary"
                    )}
                  >
                    <Icon aria-hidden className="size-6" strokeWidth={current ? 2.25 : 1.75} />
                  </Link>
                </li>
              )
            })}
        </ul>
      </nav>
    </>
  )
}
