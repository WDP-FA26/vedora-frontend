import { cookies } from "next/headers"

import { AuthProvider } from "@/features/auth/components/auth-provider"
import { getAccessToken, requireAuth } from "@/features/auth/server/session"
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

export default async function MainLayout({ children }: LayoutProps<"/home">) {
  const [user, accessToken] = await Promise.all([
    requireAuth("/home"),
    getAccessToken(),
  ])
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
