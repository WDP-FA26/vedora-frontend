import type { Metadata } from "next"

import { ProfileView } from "@/features/profiles/components/profile-view"

export const metadata: Metadata = {
  title: "Hồ sơ · Vedora",
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ProfileView id={id} />
}
