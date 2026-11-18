import type { Metadata } from "next"
import { cookies } from "next/headers"

import { Landing } from "@/features/landing/components/landing"
import { getAccessToken, getAuth } from "@/features/auth/server/session"
import { PostDraftSession } from "@/features/post-drafts/provider"
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

export const metadata: Metadata = {
  title: "Giới thiệu · Vedora",
  description:
    "Vì sao ăn xanh tốt cho cơ thể và Trái Đất, và Vedora giúp bạn nấu ăn thuần thực vật cùng cộng đồng như thế nào.",
}

export default async function LandingPage() {
  const [user, token] = await Promise.all([getAuth().catch(() => null), getAccessToken()])
  const cookieStore = await cookies()
  const petPreference = {
    pet: parsePet(cookieStore.get(PET_COOKIE)?.value),
    offset: parseOffset(cookieStore.get(PET_OFFSET_COOKIE)?.value),
  }

  return (
    <PetProvider initial={petPreference}>
      <PostDraftSession userId={user?.id} token={token} updateFeed={false} />
      <Landing />
      <NutritionPet />
    </PetProvider>
  )
}
