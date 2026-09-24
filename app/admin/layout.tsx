import { cookies } from "next/headers"

import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
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
      <SidebarProvider defaultOpen={sidebarOpen}>
        <AdminSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur">
            <SidebarTrigger className="-ml-1" aria-label="Thu gọn hoặc mở thanh bên" />
            <Separator orientation="vertical" className="mr-1 h-4 self-center!" />
            <span className="text-sm font-medium text-muted-foreground">
              Vedora Quản trị
            </span>
          </header>
          <div className="flex-1 p-4 md:p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </AuthProvider>
  )
}
