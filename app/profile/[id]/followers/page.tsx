import type { Metadata } from "next"

import { ProfileList } from "@/features/profiles/components/profile-list"

export const metadata: Metadata = {
  title: "Người theo dõi · Vedora",
}

export default async function FollowersPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ProfileList id={id} kind="followers" />
}
