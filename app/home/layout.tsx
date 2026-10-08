
import { cookies } from "next/headers"

import { AuthProvider } from "@/features/auth/components/auth-provider"
import { getAccessToken, requireAuth } from "@/features/auth/server/session"
import { MainColumns } from "@/features/shared/components/main-columns"
import { LeftNav } from "@/features/shared/components/left-nav"
import { MobileBottomNav } from "@/features/shared/components/mobile-nav"
import { NutritionPet, PetProvider } from "@/features/shared/components/nutrition-pet"
import { RightRail } from "@/features/shared/components/right-rail"
import {
  PET_COOKIE,
  PET_OFFSET_COOKIE,
  parseOffset,
  parsePet,
} from "@/features/shared/lib/pet-preference"

export default async function MainLayout({ children }: LayoutProps<"/home">) {
  const [user, accessToken, cookieStore] = await Promise.all([
    requireAuth("/home"),
    getAccessToken(),
    cookies(),
  ])
  const petPreference = {
    pet: parsePet(cookieStore.get(PET_COOKIE)?.value),
    offset: parseOffset(cookieStore.get(PET_OFFSET_COOKIE)?.value),
  }

  return (
    <PetProvider initial={petPreference}>
      <AuthProvider accessToken={accessToken} user={user}>
        <div className="mx-auto flex w-full max-w-[79rem] flex-1 justify-center">
          <LeftNav />
          <MainColumns rail={<RightRail />}>{children}</MainColumns>
          <MobileBottomNav />
        </div>
        <NutritionPet compact />
      </AuthProvider>
    </PetProvider>
  )
}
