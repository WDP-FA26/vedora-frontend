import { AuthProvider } from "@/features/auth/components/auth-provider"
import { getAccessToken, requireAuth } from "@/features/auth/server/session"
import { NotificationStream } from "@/features/notifications/components/notification-stream"
import { MessagingStream } from "@/features/messaging/components/messaging-stream"

import { Toaster } from "@/components/ui/toast"
import { MainColumns } from "@/features/shared/components/main-columns"
import { LeftNav } from "@/features/shared/components/left-nav"
import { MobileBottomNav } from "@/features/shared/components/mobile-nav"
import { RightRail } from "@/features/shared/components/right-rail"

export default async function MainLayout({ children }: LayoutProps<"/home">) {
  const [user, accessToken] = await Promise.all([requireAuth("/home"), getAccessToken()])

  return (
    <AuthProvider accessToken={accessToken} user={user}>
      <NotificationStream />
      <MessagingStream />
      <div className="vedora-main-shell mx-auto flex w-full max-w-[79rem] flex-1 justify-center">
        <LeftNav />
        <MainColumns rail={<RightRail />}>{children}</MainColumns>
        <MobileBottomNav />
      </div>
      <Toaster />
    </AuthProvider>
  )
}
