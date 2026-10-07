
import { AuthProvider } from "@/features/auth/components/auth-provider"
import { getAccessToken, requireAuth } from "@/features/auth/server/session"
import { MainColumns } from "@/features/shared/components/main-columns"
import { LeftNav } from "@/features/shared/components/left-nav"
import { MobileBottomNav } from "@/features/shared/components/mobile-nav"
import { RightRail } from "@/features/shared/components/right-rail"

export default async function MainLayout({ children }: LayoutProps<"/home">) {
  const [user, accessToken] = await Promise.all([
    requireAuth("/home"),
    getAccessToken(),
  ])
  return (
    <AuthProvider accessToken={accessToken} user={user}>
        <div className="mx-auto flex w-full max-w-[79rem] flex-1 justify-center">
          <LeftNav />
          <MainColumns rail={<RightRail />}>{children}</MainColumns>
          <MobileBottomNav />
        </div>
    </AuthProvider>
  )
}
