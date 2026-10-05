import Link from "next/link"
import { cookies } from "next/headers"

import { Button } from "@/components/ui/button"
import { AuthProvider } from "@/features/auth/components/auth-provider"
import { getAccessToken, getAuth } from "@/features/auth/server/session"
import { LeftNav } from "@/features/shared/components/left-nav"
import { MobileBottomNav } from "@/features/shared/components/mobile-nav"
import {
  NutritionPet,
  PetProvider,
} from "@/features/shared/components/nutrition-pet"
import {
  PET_COOKIE,
  PET_OFFSET_COOKIE,
  parseOffset,
  parsePet,
} from "@/features/shared/lib/pet-preference"
import { RightRail } from "@/features/shared/components/right-rail"
import { Wordmark } from "@/features/shared/components/wordmark"

/**
 * Profiles are public. Signed-in visitors get the same shell as `/home`;
 * guests get the page alone under a bar that leads to sign-in.
 */
export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
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

  const cookieStore = await cookies()
  const petPreference = {
    pet: parsePet(cookieStore.get(PET_COOKIE)?.value),
    offset: parseOffset(cookieStore.get(PET_OFFSET_COOKIE)?.value),
  }

  return (
    <AuthProvider accessToken={accessToken} user={user}>
      <PetProvider initial={petPreference}>
        <div className="mx-auto flex w-full max-w-[79rem] flex-1 justify-center">
          <LeftNav />
          <main className="min-h-dvh w-full max-w-[37.5rem] min-w-0 bg-card sm:border-x sm:border-border">
            {children}
          </main>
          <RightRail />
          <MobileBottomNav />
          <NutritionPet />
        </div>
      </PetProvider>
    </AuthProvider>
  )
}
