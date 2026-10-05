import { redirect } from "next/navigation"

import { requireAuth } from "@/features/auth/server/session"
import { profilePath } from "@/features/profiles/profiles-cache"

/** "Hồ sơ" in the nav: your own public profile page. */
export default async function MyProfilePage() {
  const user = await requireAuth("/home/profile")
  redirect(profilePath(user.id))
}
