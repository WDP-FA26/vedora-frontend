"use client"

import { useState } from "react"
import { Repeat2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { PostCard } from "@/features/home/components/post-card"
import { toFeedPost } from "@/features/posts/lib/to-feed-post"
import { useRepostPage } from "@/features/profiles/hooks/use-repost-page"

/**
 * The public "Đăng lại" tab of profile `id`: posts it reposted, newest repost
 * first, one page per "Xem thêm".
 */
export function ProfileReposts({ id }: { id: string }) {
  const [cursors, setCursors] = useState<string[]>([])

  return (
    <>
      <RepostPage
        userId={id}
        isFirst
        isLast={cursors.length === 0}
        onLoadMore={(next) => setCursors([next])}
      />
      {cursors.map((cursor, index) => (
        <RepostPage
          key={cursor}
          userId={id}
          cursor={cursor}
          isFirst={false}
          isLast={index === cursors.length - 1}
          onLoadMore={(next) => setCursors([...cursors, next])}
        />
      ))}
    </>
  )
}

function RepostPage({
  userId,
  cursor,
  isFirst,
  isLast,
  onLoadMore,
}: {
  userId: string
  cursor?: string
  isFirst: boolean
  isLast: boolean
  onLoadMore: (cursor: string) => void
}) {
  const { posts, nextCursor, error, isLoading, retry } = useRepostPage(userId, cursor)

  if (isLoading && posts.length === 0) {
    return (
      <div className="flex justify-center p-6">
        <Spinner aria-label="Đang tải bài đăng lại" />
      </div>
    )
  }

  if (error && posts.length === 0) {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-5">
        <p className="text-sm text-destructive">Không tải được bài đăng lại.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void retry()}>
          Thử lại
        </Button>
      </div>
    )
  }

  // A page can be empty while later ones are not: reposts of hidden posts are skipped.
  if (isFirst && posts.length === 0 && !nextCursor) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Repeat2Icon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Chưa đăng lại bài nào</EmptyTitle>
          <EmptyDescription>Bài viết được đăng lại sẽ hiện ở đây.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <>
      {posts.map((post) => (
        <PostCard key={post.id} post={toFeedPost(post)} />
      ))}
      {isLast && nextCursor && (
        <div className="flex justify-center p-4">
          <Button type="button" variant="outline" size="sm" shape="pill" onClick={() => onLoadMore(nextCursor)}>
            Xem thêm
          </Button>
        </div>
      )}
    </>
  )
}
