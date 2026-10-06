import type { CSSProperties } from "react"
import { cookies } from "next/headers"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AdminHeader } from "@/features/admin/components/admin-header"
import { AdminSidebar } from "@/features/admin/components/admin-sidebar"
import { AuthProvider } from "@/features/auth/components/auth-provider"
import { getAccessToken, getAuth } from "@/features/auth/server/session"

/** Written by `SidebarProvider` whenever the sidebar is expanded or collapsed. */
const SIDEBAR_COOKIE = "sidebar_state"

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const [user, accessToken, cookieStore] = await Promise.all([
    getAuth(),
    getAccessToken(),
    cookies(),
  ])
  const sidebarOpen = cookieStore.get(SIDEBAR_COOKIE)?.value !== "false"

  return (
    <AuthProvider accessToken={accessToken} user={user}>
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
    </AuthProvider>
  )
}
