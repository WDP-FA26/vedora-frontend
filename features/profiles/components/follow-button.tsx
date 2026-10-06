"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useFollow } from "@/features/profiles/hooks/use-follow"
import { profilePath } from "@/features/profiles/profiles-cache"

/** Follow toggle. Guests are sent to sign in, then back to this profile. */
export function FollowButton({ id }: { id: string }) {
  const { accessToken } = useAuth()
  const { isFollowing, isLoading, isPending, toggle } = useFollow(id)

  if (!accessToken) {
    return (
      <Button
        shape="pill"
        nativeButton={false}
        render={<Link href={`/login?next=${encodeURIComponent(profilePath(id))}`} />}
      >
        Theo dõi
      </Button>
    )
  }

  return (
    <Button
      type="button"
      shape="pill"
      variant={isFollowing ? "outline" : "default"}
      aria-pressed={isFollowing}
      disabled={isLoading || isPending}
      onClick={toggle}
    >
      {isFollowing ? "Đang theo dõi" : "Theo dõi"}
    </Button>
  )
}
