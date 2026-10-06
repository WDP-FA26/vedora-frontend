"use client"

import Link from "next/link"
import { ArrowLeftIcon, UsersIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { ProfileAvatar } from "@/features/profiles/components/profile-avatar"
import { useProfileList } from "@/features/profiles/hooks/use-profile-list"
import { profilePath, type ProfileListKind } from "@/features/profiles/profiles-cache"

const copy: Record<ProfileListKind, { title: string; empty: string }> = {
  followers: { title: "Người theo dõi", empty: "Chưa có ai theo dõi hồ sơ này." },
  following: { title: "Đang theo dõi", empty: "Hồ sơ này chưa theo dõi ai." },
}

/** The followers or following of profile `id`, with a "load more" button. */
export function ProfileList({ id, kind }: { id: string; kind: ProfileListKind }) {
  const { profiles, hasMore, loadMore, error, isLoading, isLoadingMore } = useProfileList(
    id,
    kind
  )
  const { title, empty } = copy[kind]

  return (
    <section aria-labelledby="profile-list-title">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-card/85 px-2 py-2 backdrop-blur-md">
        <Button
          variant="ghost"
          size="icon"
          shape="pill"
          aria-label="Quay lại hồ sơ"
          nativeButton={false}
          render={<Link href={profilePath(id)} />}
        >
          <ArrowLeftIcon aria-hidden />
        </Button>
        <h1 id="profile-list-title" className="text-lg font-bold">
          {title}
        </h1>
      </header>

      {isLoading ? (
        <div className="flex justify-center p-6">
          <Spinner aria-label="Đang tải" />
        </div>
      ) : error ? (
        <p role="alert" className="p-4 text-sm text-destructive sm:px-5">
          Không tải được danh sách. Thử tải lại trang nhé.
        </p>
      ) : profiles.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{title}</EmptyTitle>
            <EmptyDescription>{empty}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul>
          {profiles.map((profile) => (
            <li key={profile.id} className="border-b border-border">
              <Link
                href={profilePath(profile.id)}
                className="flex gap-3 px-4 py-3 hover:bg-muted/60 sm:px-5"
              >
                <ProfileAvatar profile={profile} size="lg" />
                <div className="min-w-0">
                  <p className="truncate font-bold">{profile.fullName}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    @{profile.username}
                  </p>
                  {profile.bio && <p className="mt-1 line-clamp-2 text-sm">{profile.bio}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="flex justify-center p-4">
          <Button type="button" variant="outline" disabled={isLoadingMore} onClick={loadMore}>
            {isLoadingMore && <Spinner aria-hidden />}
            Tải thêm
          </Button>
        </div>
      )}
    </section>
  )
}
