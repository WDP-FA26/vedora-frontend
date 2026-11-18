"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useFollow } from "@/features/profiles/hooks/use-follow"
import { profilePath } from "@/features/profiles/profiles-cache"

/** Follow toggle. Guests are sent to sign in, then back to `redirectTo` (or this profile). */
export function FollowButton({
  id,
  initialIsFollowing,
  size = "default",
  redirectTo,
  labelSuffix,
}: {
  id: string
  initialIsFollowing?: boolean
  size?: "default" | "pill-sm"
  redirectTo?: string
  labelSuffix?: string
}) {
  const { accessToken } = useAuth()
  const { isFollowing, isLoading, isPending, toggle } = useFollow(id, initialIsFollowing)

  if (!accessToken) {
    const nextTarget = redirectTo ?? profilePath(id)
    return (
      <Button
        size={size}
        shape="pill"
        nativeButton={false}
        render={<Link href={`/login?next=${encodeURIComponent(nextTarget)}`} />}
      >
        Theo dõi
        {labelSuffix && <span className="sr-only"> {labelSuffix}</span>}
      </Button>
    )
  }

  return (
    <Button
      type="button"
      size={size}
      shape="pill"
      variant={isFollowing ? "outline" : "default"}
      aria-pressed={isFollowing}
      disabled={isLoading || isPending}
      onClick={toggle}
    >
      {isFollowing ? "Đang theo dõi" : "Theo dõi"}
      {labelSuffix && <span className="sr-only"> {labelSuffix}</span>}
    </Button>
  )
}
