"use client"

import Link from "next/link"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { FollowButton } from "@/features/profiles/components/follow-button"
import { ProfileAvatar } from "@/features/profiles/components/profile-avatar"
import { profilePath } from "@/features/profiles/profiles-cache"
import type { ProfileSearchItem } from "@/features/profiles/schemas"
import { VerifiedBadge } from "@/features/shared/components/verified-badge"
import { PROFESSIONAL_LABEL } from "@/features/verification/schemas"

/** Profile search row with link to the user's profile and an inline Follow toggle. */
export function ProfileSearchRow({
  profile,
  redirectTo,
}: {
  profile: ProfileSearchItem
  redirectTo?: string
}) {
  const { user } = useAuth()
  const isSelf = user?.id === profile.id

  return (
    <li className="flex items-start gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-muted/60 sm:px-5">
      <Link href={profilePath(profile.id)} className="flex min-w-0 flex-1 items-start gap-3">
        <ProfileAvatar profile={profile} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate font-bold">{profile.fullName}</span>
            {profile.isProfessional && <VerifiedBadge label={PROFESSIONAL_LABEL} />}
          </div>
          <p className="truncate text-sm text-muted-foreground">@{profile.username}</p>
          {profile.bio && <p className="mt-1 line-clamp-2 text-sm">{profile.bio}</p>}
        </div>
      </Link>
      {!isSelf && (
        <div className="shrink-0 pt-0.5">
          <FollowButton
            id={profile.id}
            initialIsFollowing={profile.isFollowing}
            size="pill-sm"
            redirectTo={redirectTo}
            labelSuffix={profile.fullName}
          />
        </div>
      )}
    </li>
  )
}
