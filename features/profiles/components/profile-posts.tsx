"use client"

import { SproutIcon } from "lucide-react"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { PostCard } from "@/features/home/components/post-card"
import { formatCount } from "@/features/shared/lib/format"
import { toFeedPost } from "@/features/posts/lib/to-feed-post"
import { useProfilePosts } from "@/features/profiles/hooks/use-profile-posts"

/** The published posts of profile `id`, under the profile header. */
export function ProfilePosts({ id, count }: { id: string; count: number }) {
  const { posts, error, isLoading } = useProfilePosts(id)

  return (
    <section aria-labelledby="profile-posts-title" className="border-t border-border">
      <h2 id="profile-posts-title" className="px-4 pt-4 text-base font-bold sm:px-5">
        Bài viết{" "}
        <span className="font-normal text-muted-foreground tabular-nums">
          {formatCount(count)}
        </span>
      </h2>

      {isLoading ? (
        <div className="flex justify-center p-6">
          <Spinner aria-label="Đang tải bài viết" />
        </div>
      ) : error ? (
        <p role="alert" className="p-4 text-sm text-destructive sm:px-5">
          Không tải được bài viết. Thử tải lại trang nhé.
        </p>
      ) : posts.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SproutIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Chưa có bài viết</EmptyTitle>
            <EmptyDescription>Bài đăng công khai sẽ hiện ở đây.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        posts.map((post) => <PostCard key={post.id} post={toFeedPost(post)} />)
      )}
    </section>
  )
}
