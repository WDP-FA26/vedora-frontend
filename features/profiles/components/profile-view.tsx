"use client"

import Link from "next/link"
import { BadgeCheckIcon, CalendarDaysIcon, UtensilsCrossedIcon } from "lucide-react"

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
import { VerifiedBadge } from "@/features/shared/components/verified-badge"
import { formatCount } from "@/features/shared/lib/format"
import { PROFESSIONAL_LABEL } from "@/features/verification/schemas"
import { DIETARY_PATH } from "@/features/dietary/dietary"
import { VERIFICATION_PATH } from "@/features/verification/verification-cache"

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
    {
      label: "Đang theo dõi",
      value: profile.followingCount,
      href: `${profilePath(profile.id)}/following`,
    },
    {
      label: "Người theo dõi",
      value: profile.followerCount,
      href: `${profilePath(profile.id)}/followers`,
    },
  ]

  return (
    <article aria-label={`Hồ sơ của ${profile.fullName}`}>
      <ProfileCover profile={profile} />

      <div className="px-4 pt-3 pb-4">
        <div className="flex items-start justify-between gap-3">
          {/* A quarter of the column, half of it over the cover; the border separates the two. */}
          <div className="-mt-[15%] aspect-square w-1/4 min-w-12 rounded-full border-4 border-card bg-card">
            <ProfileAvatar profile={profile} size="fill" />
          </div>
          {isOwn ? (
            <EditProfileDialog
              profile={profile}
              trigger={
                <Button type="button" variant="outline" shape="pill" size="pill">
                  Chỉnh sửa hồ sơ
                </Button>
              }
            />
          ) : (
            <FollowButton id={profile.id} />
          )}
        </div>

        <div className="mt-1 min-w-0">
          <div className="flex items-center gap-1">
            <h1 className="truncate text-xl leading-6 font-extrabold">{profile.fullName}</h1>
            {profile.isProfessional && <VerifiedBadge label={PROFESSIONAL_LABEL} />}
          </div>
          <p className="truncate text-[0.9375rem] leading-5 text-muted-foreground">
            @{profile.username}
          </p>
        </div>

        {profile.bio && (
          <p className="mt-3 text-[0.9375rem] leading-5 whitespace-pre-line">{profile.bio}</p>
        )}

        <p className="mt-3 flex items-center gap-1 text-[0.9375rem] leading-5 text-muted-foreground">
          <CalendarDaysIcon aria-hidden className="size-[1.125rem]" />
          Tham gia {formatJoinDate(profile.createdAt)}
        </p>

        {isOwn && !profile.isProfessional && (
          <Link
            href={VERIFICATION_PATH}
            className="mt-1 inline-flex items-center gap-1 text-[0.9375rem] leading-5 text-primary underline-offset-4 hover:underline"
          >
            <BadgeCheckIcon aria-hidden className="size-[1.125rem]" />
            Xác minh tài khoản chuyên gia
          </Link>
        )}

        {isOwn && (
          <Link
            href={DIETARY_PATH}
            className="mt-1 flex w-fit items-center gap-1 text-[0.9375rem] leading-5 text-primary underline-offset-4 hover:underline"
          >
            <UtensilsCrossedIcon aria-hidden className="size-[1.125rem]" />
            Thực phẩm tôi không ăn
          </Link>
        )}

        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm leading-5">
          {counts.map(({ label, value, href }) => (
            <li key={label}>
              <Link href={href} className="hover:underline">
                <span className="font-bold tabular-nums">{formatCount(value)}</span>{" "}
                <span className="text-muted-foreground">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <ProfilePosts id={profile.id} count={profile.postCount} />
    </article>
  )
}

function ProfileSkeleton() {
  return (
    <div aria-busy aria-label="Đang tải hồ sơ" className="animate-pulse">
      <div className="aspect-[3/1] w-full bg-muted" />
      <div className="px-4 pt-3 pb-4">
        <div className="-mt-[15%] aspect-square w-1/4 min-w-12 rounded-full border-4 border-card bg-muted" />
        <div className="mt-2 h-6 w-48 rounded-md bg-muted" />
        <div className="mt-2 h-4 w-32 rounded-md bg-muted" />
        <div className="mt-4 h-4 w-56 rounded-md bg-muted" />
      </div>
    </div>
  )
}
