"use client"

import { useState } from "react"
import Link from "next/link"
import { BookOpenTextIcon, PenLineIcon, RotateCcwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { blogPath, editBlogPath, NEW_BLOG_PATH } from "@/features/blogs/blogs-cache"
import { BlogStatusBadge } from "@/features/blogs/components/blog-status-badge"
import { plainExcerpt } from "@/features/blogs/lib/plain-excerpt"
import { useMyBlogs } from "@/features/blogs/hooks/use-blogs"
import type { BlogStatus } from "@/features/blogs/schemas"
import type { ApiPost } from "@/features/posts/schemas"
import { formatPostDateLong } from "@/features/shared/lib/format"

type Filter = "ALL" | BlogStatus

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "DRAFT", label: "Nháp" },
  { value: "PUBLISHED", label: "Đã xuất bản" },
]

const EMPTY_COPY: Record<Filter, string> = {
  ALL: "Bài blog bạn viết sẽ nằm ở đây, kể cả bản nháp chưa xuất bản.",
  DRAFT: "Không có bản nháp nào. Bài lưu nháp chỉ mình bạn thấy.",
  PUBLISHED: "Chưa có bài nào được xuất bản.",
}

/** The signed-in user's own blogs, drafts included. Only they see this page. */
export function MyBlogsView() {
  const [filter, setFilter] = useState<Filter>("ALL")

  return (
    <section aria-labelledby="my-blogs-title">
      <header className="sticky top-0 z-20 border-b border-border bg-card/85 backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 pt-2 sm:px-5">
          <div className="min-w-0 flex-1">
            <h1 id="my-blogs-title" className="text-lg font-bold">
              Blog của tôi
            </h1>
            <p className="text-sm text-muted-foreground">Bản nháp chỉ mình bạn thấy.</p>
          </div>
          <Button shape="pill" nativeButton={false} render={<Link href={NEW_BLOG_PATH} />}>
            <PenLineIcon aria-hidden /> Viết blog
          </Button>
        </div>
        <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
          <TabsList variant="timeline" aria-label="Lọc theo trạng thái">
            {FILTERS.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </header>

      {/* A new list per filter: the cursor of one filter means nothing to another. */}
      <BlogList key={filter} filter={filter} />
    </section>
  )
}

function BlogList({ filter }: { filter: Filter }) {
  const { blogs, hasMore, loadMore, error, isLoading, isLoadingMore, refresh } = useMyBlogs(
    filter === "ALL" ? null : filter
  )

  if (isLoading) {
    return (
      <div className="flex justify-center p-6">
        <Spinner aria-label="Đang tải blog của bạn" />
      </div>
    )
  }

  if (error && blogs.length === 0) {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm sm:px-5">
        <span>Không tải được blog của bạn.</span>
        <Button variant="outline" size="sm" shape="pill" onClick={() => void refresh()}>
          <RotateCcwIcon aria-hidden /> Thử lại
        </Button>
      </div>
    )
  }

  if (blogs.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookOpenTextIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Chưa có bài nào</EmptyTitle>
          <EmptyDescription>{EMPTY_COPY[filter]}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button shape="pill" nativeButton={false} render={<Link href={NEW_BLOG_PATH} />}>
            <PenLineIcon aria-hidden /> Viết blog đầu tiên
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <div className="pb-24 sm:pb-4">
      <ul>
        {blogs.map((post) => (
          <MyBlogRow key={post.id} post={post} />
        ))}
      </ul>
      {hasMore && (
        <div className="flex justify-center p-4">
          <Button variant="outline" shape="pill" disabled={isLoadingMore} onClick={() => void loadMore()}>
            {isLoadingMore && <Spinner aria-hidden />}
            Tải thêm
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="px-4 pb-4 text-center text-sm text-destructive">
          Không tải thêm được. Thử lại nhé.
        </p>
      )}
    </div>
  )
}

function MyBlogRow({ post }: { post: ApiPost }) {
  const title = post.blog?.title ?? "Bài viết không có tiêu đề"
  const published = post.status === "PUBLISHED"
  const excerpt = plainExcerpt(post.blog?.excerpt ?? "")

  return (
    <li className="flex flex-col gap-1.5 border-b border-border px-4 py-4 sm:px-5">
      <div className="flex items-start gap-2">
        <Link
          href={published ? blogPath(post.id) : editBlogPath(post.id)}
          className="min-w-0 flex-1 text-[0.9375rem] leading-snug font-semibold hover:underline"
        >
          {title}
        </Link>
        <BlogStatusBadge status={post.status} />
      </div>
      {excerpt && <p className="line-clamp-2 text-sm text-muted-foreground">{excerpt}</p>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {/* A draft may still carry the `publishedAt` of an earlier publication. */}
        {published && post.publishedAt ? (
          <time dateTime={post.publishedAt}>Xuất bản {formatPostDateLong(post.publishedAt)}</time>
        ) : (
          <time dateTime={post.createdAt}>Tạo {formatPostDateLong(post.createdAt)}</time>
        )}
        <Button
          variant="link"
          size="sm"
          className="h-auto px-0"
          nativeButton={false}
          render={<Link href={editBlogPath(post.id)} />}
        >
          Sửa
        </Button>
      </div>
    </li>
  )
}
