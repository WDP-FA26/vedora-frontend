"use client"

import { SearchIcon } from "lucide-react"

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
import { PostSearchForm } from "@/features/posts/components/post-search-form"
import { usePostSearch } from "@/features/posts/hooks/use-post-search"
import { toFeedPost } from "@/features/posts/lib/to-feed-post"

/** Posts matching `q` by meaning and keywords, best match first. */
export function SearchView({ q }: { q: string }) {
  const { posts, hasMore, loadMore, error, isLoading, isLoadingMore } = usePostSearch(q)

  return (
    <section aria-labelledby="search-title">
      <header className="sticky top-0 z-20 space-y-2 border-b border-border bg-card/85 px-4 py-2 backdrop-blur-md sm:px-5">
        <h1 id="search-title" className="sr-only">
          {q ? `Kết quả tìm kiếm cho “${q}”` : "Tìm kiếm"}
        </h1>
        <PostSearchForm defaultValue={q} autoFocus={!q} />
      </header>

      {!q ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Tìm bài viết trên Vedora</EmptyTitle>
            <EmptyDescription>
              Gõ tên món, nguyên liệu hay mẹo nấu ăn. Có thể gõ không dấu.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : isLoading ? (
        <div className="flex justify-center p-6">
          <Spinner aria-label="Đang tìm bài viết" />
        </div>
      ) : error ? (
        <p role="alert" className="p-4 text-sm text-destructive sm:px-5">
          Không tìm được lúc này. Thử lại sau ít phút nhé.
        </p>
      ) : posts.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Không có bài viết phù hợp</EmptyTitle>
            <EmptyDescription>
              Thử từ khóa khác, ngắn hơn, hoặc tên một nguyên liệu.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {posts.map((post) => (
            <PostCard key={post.id} post={toFeedPost(post)} />
          ))}
          {hasMore && (
            <div className="flex justify-center p-4">
              <Button type="button" variant="outline" disabled={isLoadingMore} onClick={loadMore}>
                {isLoadingMore && <Spinner aria-hidden />}
                Xem thêm kết quả
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
