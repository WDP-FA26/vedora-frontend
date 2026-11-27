"use client"

import { useState } from "react"
import Link from "next/link"
import { cn } from "cn"
import { ChevronLeftIcon, ChevronRightIcon, FileTextIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { postPath } from "@/features/posts/posts-cache"
import { useAnalyticsPosts } from "../hooks/use-post-analytics"
import { formatPublishedAt } from "../lib/date-range"
import { METRIC_META, numberFormat } from "../lib/metrics"
import { isPostSort, POST_SORTS, type DateRange, type PostSort } from "../post-analytics-cache"
import type { AnalyticsPost } from "../schemas"

const SORT_LABELS: Record<PostSort, string> = {
  recent: "Mới đăng",
  saves: "Lượt lưu",
  comments: "Bình luận",
  likes: "Thích",
  reposts: "Đăng lại",
  views: "Lượt xem",
}

const ROW_METRICS = ["saves", "comments", "likes", "reposts", "views"] as const

function postLabel(post: AnalyticsPost): string {
  if (post.title !== null) return post.title
  if (post.type === "BLOG") return "Blog không có tiêu đề"
  return "Bài viết chỉ có video"
}

function PostRow({ post, sort }: { post: AnalyticsPost; sort: PostSort }) {
  return (
    <li className="px-4 py-3 transition-colors hover:bg-muted/40">
      <div className="flex items-start justify-between gap-3">
        <Link href={postPath(post.id)} className="min-w-0 flex-1 hover:underline">
          <p className="line-clamp-2 text-sm font-medium">{postLabel(post)}</p>
        </Link>
        {post.type === "BLOG" && <Badge variant="secondary">Blog</Badge>}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {post.publishedAt === null ? "Đang công khai" : `Đăng ${formatPublishedAt(post.publishedAt)}`}
        {" · "}
        {numberFormat.format(post.lifetimeViews)} lượt xem từ trước đến nay
      </p>
      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {ROW_METRICS.map((metric) => {
          const { label, icon: Icon } = METRIC_META[metric]
          return (
            <div key={metric} className={cn("flex items-center gap-1", metric === sort && "font-semibold text-foreground")}>
              <dt>
                <Icon aria-hidden className="size-3.5" />
                <span className="sr-only">{label}</span>
              </dt>
              <dd className="tabular-nums">{numberFormat.format(post.period[metric])}</dd>
            </div>
          )
        })}
      </dl>
    </li>
  )
}

function PostsBody({ range, sort, page, onPage }: { range: DateRange; sort: PostSort; page: number; onPage: (page: number) => void }) {
  const { data, error, isLoading } = useAnalyticsPosts(range, sort, page)

  if (error) {
    return (
      <p role="alert" className="px-4 py-6 text-sm text-destructive">
        Không tải được danh sách bài viết. Thử tải lại trang nhé.
      </p>
    )
  }
  if (isLoading || !data) {
    return (
      <div role="status" aria-label="Đang tải bài viết" className="space-y-3 p-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    )
  }
  if (data.meta.totalItems === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <FileTextIcon aria-hidden className="size-7 text-muted-foreground" />
        <p className="text-sm font-medium">Bạn chưa có bài viết công khai</p>
        <p className="text-sm text-muted-foreground">Khi bạn Đăng bài, số liệu của từng bài sẽ hiện ở đây.</p>
      </div>
    )
  }

  return (
    <>
      <ul className="divide-y">
        {data.items.map((post) => (
          <PostRow key={post.id} post={post} sort={sort} />
        ))}
      </ul>
      {data.meta.totalPages > 1 && (
        <nav aria-label="Phân trang bài viết" className="flex items-center justify-between border-t px-2 py-1.5">
          <Button variant="ghost" size="sm" disabled={!data.meta.hasPreviousPage} onClick={() => onPage(page - 1)}>
            <ChevronLeftIcon aria-hidden />
            Trước
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            Trang {data.meta.page}/{data.meta.totalPages}
          </span>
          <Button variant="ghost" size="sm" disabled={!data.meta.hasNextPage} onClick={() => onPage(page + 1)}>
            Sau
            <ChevronRightIcon aria-hidden />
          </Button>
        </nav>
      )}
    </>
  )
}

export function AnalyticsPosts({ range }: { range: DateRange }) {
  const [sort, setSort] = useState<PostSort>("recent")
  const [page, setPage] = useState(1)

  function changeSort(value: string) {
    if (!isPostSort(value)) return
    setSort(value)
    setPage(1)
  }

  return (
    <section aria-labelledby="analytics-posts-title" className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 id="analytics-posts-title" className="font-semibold">Bài viết của bạn</h2>
          <p className="text-xs text-muted-foreground">Số liệu trong khoảng đã chọn, gồm cả bài đăng trước đó.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sắp xếp</span>
          <NativeSelect size="sm" value={sort} onChange={(event) => changeSort(event.target.value)}>
            {POST_SORTS.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {SORT_LABELS[value]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
      </div>
      <PostsBody range={range} sort={sort} page={page} onPage={setPage} />
    </section>
  )
}
