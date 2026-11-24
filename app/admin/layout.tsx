import type { CSSProperties } from "react"
import { cookies } from "next/headers"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AdminHeader } from "@/features/admin/components/admin-header"
import { AdminSidebar } from "@/features/admin/components/admin-sidebar"
import { AuthProvider } from "@/features/auth/components/auth-provider"
import { redirect } from "next/navigation"
import { getAccessToken, requireAuth } from "@/features/auth/server/session"
import { AdminWorkQueueProvider } from "@/features/admin/overview/work-queue-provider"

/** Written by `SidebarProvider` whenever the sidebar is expanded or collapsed. */
const SIDEBAR_COOKIE = "sidebar_state"

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const [user, accessToken, cookieStore] = await Promise.all([
    requireAuth("/admin"),
    getAccessToken(),
    cookies(),
  ])
  // The proxy already sends signed-out visitors to /login; this covers members.
  if (user.role !== "ADMIN") redirect("/home")
  const sidebarOpen = cookieStore.get(SIDEBAR_COOKIE)?.value !== "false"

  return (
    <AuthProvider accessToken={accessToken} user={user}>
      <AdminWorkQueueProvider>
        <SidebarProvider
          defaultOpen={sidebarOpen}
          style={{ "--sidebar-width": "15rem" } as CSSProperties}
        >
          <AdminSidebar />
          <SidebarInset className="min-w-0">
            <AdminHeader />
            {children}
          </SidebarInset>
        </SidebarProvider>
      </AdminWorkQueueProvider>
    </AuthProvider>
  )
}
