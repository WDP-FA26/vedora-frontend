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
import { Button } from "@/components/ui/button"
import { PostCard } from "@/features/home/components/post-card"
import { formatCount } from "@/features/shared/lib/format"
import { toFeedPost } from "@/features/posts/lib/to-feed-post"
import { useProfilePosts } from "@/features/profiles/hooks/use-profile-posts"

/** The published posts of profile `id`, under the profile header. */
export function ProfilePosts({ id, count }: { id: string; count: number }) {
  const { posts, error, isLoading, retry } = useProfilePosts(id)

  return (
    <section aria-labelledby="profile-posts-title" className="border-t-8 border-muted/60">
      <div className="border-b border-border px-4 sm:px-5">
        <h2 id="profile-posts-title" className="inline-flex items-center gap-2 border-b-2 border-primary py-3 text-sm font-bold text-primary">
          Bài viết
          <span className="font-medium text-muted-foreground tabular-nums">{formatCount(count)}</span>
        </h2>
      </div>

      {isLoading && posts.length === 0 ? (
        <div className="flex justify-center p-6">
          <Spinner aria-label="Đang tải bài viết" />
        </div>
      ) : error && posts.length === 0 ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-5">
          <p className="text-sm text-destructive">Không tải được bài viết.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void retry()}>
            Thử lại
          </Button>
        </div>
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
