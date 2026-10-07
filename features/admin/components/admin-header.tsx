"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import {
  ADMIN_HOME,
  allAdminNavItems,
  isAdminNavActive,
} from "@/features/admin/data/nav-items"

/** Where you are in the admin area. */
export function AdminHeader() {
  const pathname = usePathname()
  const { state, isMobile } = useSidebar()
  const current = allAdminNavItems.find(({ href }) =>
    isAdminNavActive(href, pathname)
  )
  const CurrentIcon = current?.icon

  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur">
      {(isMobile || state === "collapsed") && (
        <SidebarTrigger aria-label="Mở thanh bên" />
      )}
      <Breadcrumb className="ml-1 min-w-0">
        <BreadcrumbList className="flex-nowrap">
          <BreadcrumbItem className="hidden sm:inline-flex">
            <BreadcrumbLink render={<Link href={ADMIN_HOME} />}>
              Quản trị
            </BreadcrumbLink>
          </BreadcrumbItem>
          {current && (
            <>
              <BreadcrumbSeparator className="hidden sm:block">
                /
              </BreadcrumbSeparator>
              <BreadcrumbItem className="min-w-0">
                {CurrentIcon && (
                  <CurrentIcon
                    aria-hidden
                    className="size-4 shrink-0 text-foreground"
                  />
                )}
                <h1 className="truncate font-sans text-sm font-medium text-foreground">
                  {current.label}
                </h1>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  )
}
