"use client"

import useSWR from "swr"
import { BookmarkIcon } from "lucide-react"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { PostCard } from "@/features/home/components/post-card"
import { fetchPostPage } from "@/features/posts/lib/posts-api"
import { toFeedPost } from "@/features/posts/lib/to-feed-post"
import { BOOKMARKS_KEY } from "@/features/posts/posts-cache"

/**
 * The posts the signed-in user saved. A post unsaved here stays in place, so
 * a slip can be undone, and is gone the next time the page loads.
 */
export function BookmarksView() {
  const { accessToken } = useAuth()
  const { data, error, isLoading } = useSWR(
    accessToken ? ([BOOKMARKS_KEY, accessToken] as const) : null,
    fetchPostPage
  )
  const posts = data?.items ?? []

  return (
    <section aria-labelledby="bookmarks-title">
      <header className="sticky top-0 z-20 border-b border-border bg-card/85 px-4 py-2 backdrop-blur-md sm:px-5">
        <h1 id="bookmarks-title" className="text-lg font-bold">
          Đã lưu
        </h1>
        <p className="text-sm text-muted-foreground">Chỉ mình bạn thấy danh sách này.</p>
      </header>

      {isLoading ? (
        <div className="flex justify-center p-6">
          <Spinner aria-label="Đang tải bài viết đã lưu" />
        </div>
      ) : error ? (
        <p role="alert" className="p-4 text-sm text-destructive sm:px-5">
          Không tải được bài viết đã lưu. Thử tải lại trang nhé.
        </p>
      ) : posts.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookmarkIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Chưa lưu bài viết nào</EmptyTitle>
            <EmptyDescription>
              Bấm biểu tượng dấu trang dưới một bài viết để lưu lại, rồi tìm nó ở đây.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {posts.map((post) => (
            <PostCard key={post.id} post={toFeedPost(post)} />
          ))}
          {data?.nextCursor && (
            <p className="p-4 text-center text-sm text-muted-foreground">
              Đang hiển thị 50 bài lưu gần nhất.
            </p>
          )}
        </>
      )}
    </section>
  )
}
