"use client"

import Link from "next/link"
import { BadgeCheckIcon, CalendarDaysIcon, LeafIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { DietaryOverviewCard } from "@/features/dietary/components/dietary-overview-card"
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
import { ApiError } from "@/features/shared/lib/api-client"
import { PROFESSIONAL_LABEL } from "@/features/verification/schemas"
import { VERIFICATION_PATH } from "@/features/verification/verification-cache"

/** A profile's header and posts. Public; the owner also gets the edit button. */
export function ProfileView({ id }: { id: string }) {
  const { user, accessToken } = useAuth()
  const { profile, error, isLoading, retry } = useProfile(id)

  if (isLoading && !profile) return <ProfileSkeleton />
  if (!profile) {
    const notFound = error instanceof ApiError && error.status === 404
    return (
      <section role="alert" className="mx-4 my-8 rounded-3xl border border-border bg-card px-5 py-8 text-center sm:mx-6">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-brand-sprout/15 text-brand-forest">
          <LeafIcon aria-hidden className="size-6" />
        </div>
        <h1 className="text-lg font-bold">{notFound ? "Không tìm thấy hồ sơ" : "Chưa tải được hồ sơ"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {notFound ? "Hồ sơ này không tồn tại hoặc đã được gỡ." : "Kiểm tra kết nối rồi thử lại nhé."}
        </p>
        {!notFound && (
          <Button type="button" className="mt-4" variant="outline" shape="pill" disabled={isLoading} onClick={() => void retry()}>
            Thử lại
          </Button>
        )}
      </section>
    )
  }

  const isOwn = profile.id === user?.id
  const authResolved = !accessToken || user !== null
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
      <div className="sticky top-0 z-10 border-b border-border bg-card/95 px-4 py-3 backdrop-blur-sm sm:px-5">
        <p className="text-lg font-bold leading-6">Hồ sơ</p>
        <p className="text-xs text-muted-foreground">@{profile.username}</p>
      </div>

      {error && (
        <div role="status" className="flex items-center justify-between gap-3 border-b border-border bg-brand-cream/20 px-4 py-2 text-sm sm:px-5">
          <span>Chưa cập nhật được thông tin mới nhất.</span>
          <Button type="button" variant="outline" size="sm" disabled={isLoading} onClick={() => void retry()}>
            Thử lại
          </Button>
        </div>
      )}

      <ProfileCover profile={profile} />

      <div className="px-4 pb-5 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="-mt-10 size-24 shrink-0 rounded-full border-4 border-card bg-card shadow-sm sm:-mt-12 sm:size-28">
            <ProfileAvatar profile={profile} size="fill" />
          </div>
          {authResolved && (isOwn ? (
            <EditProfileDialog
              profile={profile}
              trigger={
                <Button type="button" variant="outline" shape="pill" size="pill" className="mt-3">
                  Chỉnh sửa hồ sơ
                </Button>
              }
            />
          ) : (
            <div className="mt-3">
              <FollowButton id={profile.id} />
            </div>
          ))}
        </div>

        <div className="mt-3 min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="truncate text-2xl leading-8 font-extrabold tracking-tight">{profile.fullName}</h1>
            {profile.isProfessional && <VerifiedBadge label={PROFESSIONAL_LABEL} />}
          </div>
          <p className="truncate text-sm text-muted-foreground">@{profile.username}</p>
        </div>

        {profile.bio ? (
          <p className="mt-3 text-[0.9375rem] leading-6 whitespace-pre-line">{profile.bio}</p>
        ) : isOwn ? (
          <p className="mt-3 text-sm text-muted-foreground">Thêm lời giới thiệu để mọi người hiểu hơn về bạn.</p>
        ) : null}

        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDaysIcon aria-hidden className="size-4" />
          Tham gia {formatJoinDate(profile.createdAt)}
        </p>

        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm leading-5">
          {counts.map(({ label, value, href }) => (
            <li key={label}>
              <Link href={href} className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-ring">
                <span className="font-bold tabular-nums">{formatCount(value)}</span>{" "}
                <span className="text-muted-foreground">{label}</span>
              </Link>
            </li>
          ))}
        </ul>

        {isOwn && !profile.isProfessional && (
          <Link
            href={VERIFICATION_PATH}
            className="mt-3 inline-flex items-center gap-1 text-sm leading-5 text-primary underline-offset-4 hover:underline"
          >
            <BadgeCheckIcon aria-hidden className="size-4" />
            Xác minh tài khoản chuyên gia
          </Link>
        )}

        {isOwn && <DietaryOverviewCard userId={profile.id} />}
      </div>

      <ProfilePosts id={profile.id} count={profile.postCount} />
    </article>
  )
}

function ProfileSkeleton() {
  return (
    <div aria-busy aria-label="Đang tải hồ sơ" className="animate-pulse">
      <div className="h-14 border-b border-border bg-card" />
      <div className="aspect-[3/1] w-full bg-muted" />
      <div className="px-4 pb-5 sm:px-5">
        <div className="-mt-10 size-24 rounded-full border-4 border-card bg-muted sm:-mt-12 sm:size-28" />
        <div className="mt-3 h-7 w-48 rounded-md bg-muted" />
        <div className="mt-2 h-4 w-32 rounded-md bg-muted" />
        <div className="mt-4 h-4 w-56 rounded-md bg-muted" />
      </div>
    </div>
  )
}
