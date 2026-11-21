import type { Metadata } from "next"

import { ProfileView, type ProfileTab } from "@/features/profiles/components/profile-view"

export const metadata: Metadata = { title: "Hồ sơ" }

function parseTab(raw: string | undefined): ProfileTab {
  if (raw === "menu" || raw === "reviews") return raw
  return "posts"
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab } = await searchParams
  return <ProfileView id={id} initialTab={parseTab(tab)} />
}
