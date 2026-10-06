import type { Metadata } from "next"

import { ProfileList } from "@/features/profiles/components/profile-list"

export const metadata: Metadata = {
  title: "Đang theo dõi · Vedora",
}

export default async function FollowingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ProfileList id={id} kind="following" />
}
