import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/toast"
import { AuthProvider } from "@/features/auth/components/auth-provider"
import { getAccessToken, getAuth } from "@/features/auth/server/session"
import { NotificationStream } from "@/features/notifications/components/notification-stream"
import { MainColumns } from "@/features/shared/components/main-columns"
import { LeftNav } from "@/features/shared/components/left-nav"
import { MobileBottomNav } from "@/features/shared/components/mobile-nav"
import { RightRail } from "@/features/shared/components/right-rail"
import { Wordmark } from "@/features/shared/components/wordmark"

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [user, accessToken] = await Promise.all([getAuth(), getAccessToken()])

  if (!user) {
    return (
      <AuthProvider accessToken={undefined} user={null}>
        <div className="mx-auto flex w-full max-w-[37.5rem] flex-1 flex-col">
          <header className="flex items-center justify-between px-4 py-3">
            <Wordmark href="/" />
            <Button shape="pill" nativeButton={false} render={<Link href="/login" />}>
              Đăng nhập
            </Button>
          </header>
          <main className="min-h-dvh w-full min-w-0 bg-card sm:border-x sm:border-border">
            {children}
          </main>
        </div>
      </AuthProvider>
    )
  }

  return (
    <AuthProvider accessToken={accessToken} user={user}>
      <NotificationStream />
      <div className="vedora-main-shell mx-auto flex w-full max-w-[79rem] flex-1 justify-center">
        <LeftNav />
        <MainColumns rail={<RightRail />}>{children}</MainColumns>
        <MobileBottomNav />
      </div>
      <Toaster />
    </AuthProvider>
  )
}
