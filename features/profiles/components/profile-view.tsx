"use client"

import Link from "next/link"
import { CalendarDaysIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { EditProfileDialog } from "@/features/profiles/components/edit-profile-dialog"
import { FollowButton } from "@/features/profiles/components/follow-button"
import { ProfileAvatar } from "@/features/profiles/components/profile-avatar"
import { ProfileCover } from "@/features/profiles/components/profile-cover"
import { ProfilePosts } from "@/features/profiles/components/profile-posts"
import { useProfile } from "@/features/profiles/hooks/use-profile"
import { formatJoinDate } from "@/features/profiles/lib/format"
import { profilePath } from "@/features/profiles/profiles-cache"
import { formatCount } from "@/features/shared/lib/format"

/** A profile's header and posts. Public; the owner also gets the edit button. */
export function ProfileView({ id }: { id: string }) {
  const { user } = useAuth()
  const { profile, error, isLoading } = useProfile(id)

  if (isLoading) return <ProfileSkeleton />
  if (error || !profile) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive sm:px-5">
        Không tải được hồ sơ. Thử tải lại trang nhé.
      </p>
    )
  }

  const isOwn = profile.id === user?.id
  const counts = [
    { label: "Bài viết", value: profile.postCount },
    {
      label: "Người theo dõi",
      value: profile.followerCount,
      href: `${profilePath(profile.id)}/followers`,
    },
    {
      label: "Đang theo dõi",
      value: profile.followingCount,
      href: `${profilePath(profile.id)}/following`,
    },
  ]

  return (
    <article aria-label={`Hồ sơ của ${profile.fullName}`}>
      <ProfileCover profile={profile} />

      <div className="flex flex-col gap-3 px-4 pb-5 sm:px-5">
        <div className="flex items-end justify-between gap-3">
          {/* The ring separates the avatar from the cover it overlaps. */}
          <div className="-mt-10 rounded-full ring-4 ring-card">
            <ProfileAvatar profile={profile} size="lg" className="size-20" />
          </div>
          {isOwn ? (
            <EditProfileDialog
              profile={profile}
              trigger={
                <Button type="button" variant="outline" shape="pill">
                  Chỉnh sửa hồ sơ
                </Button>
              }
            />
          ) : (
            <FollowButton id={profile.id} />
          )}
        </div>

        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{profile.fullName}</h1>
          <p className="truncate text-sm text-muted-foreground">@{profile.username}</p>
        </div>

        {profile.bio && (
          <p className="text-[0.9375rem] leading-relaxed whitespace-pre-line">
            {profile.bio}
          </p>
        )}

        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDaysIcon aria-hidden className="size-4" />
          Tham gia {formatJoinDate(profile.createdAt)}
        </p>

        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {counts.map(({ label, value, href }) => {
            const content = (
              <>
                <span className="font-semibold tabular-nums">{formatCount(value)}</span>{" "}
                <span className="text-muted-foreground">{label}</span>
              </>
            )
            return (
              <li key={label}>
                {href ? (
                  <Link href={href} className="hover:underline">
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <ProfilePosts id={profile.id} />
    </article>
  )
}

function ProfileSkeleton() {
  return (
    <div aria-busy aria-label="Đang tải hồ sơ" className="animate-pulse">
      <div className="aspect-[3/1] w-full bg-muted" />
      <div className="flex flex-col gap-3 px-4 pb-5 sm:px-5">
        <div className="-mt-10 size-20 rounded-full bg-muted ring-4 ring-card" />
        <div className="h-6 w-48 rounded-md bg-muted" />
        <div className="h-4 w-32 rounded-md bg-muted" />
        <div className="h-4 w-full rounded-md bg-muted" />
      </div>
    </div>
  )
}
