"use client"

import Link from "next/link"
import { PenLineIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import { MY_BLOGS_KEY, NEW_BLOG_PATH, editBlogPath } from "@/features/blogs/blogs-cache"
import { fetchBlogPage } from "@/features/blogs/lib/blogs-api"
import { formatPostDate } from "@/features/shared/lib/format"
import type { ApiPost } from "@/features/posts/schemas"

/** The author's blogs, drafts first in the order the API returns them (newest created). */
const STATUS_BADGES: Record<ApiPost["status"], { label: string; variant: "default" | "secondary" | "destructive" }> = {
  DRAFT: { label: "Nháp", variant: "secondary" },
  PROCESSING: { label: "Đang kiểm duyệt", variant: "secondary" },
  PENDING_REVIEW: { label: "Chờ quản trị viên", variant: "secondary" },
  PUBLISHED: { label: "Đã đăng", variant: "default" },
  FAILED: { label: "Lỗi", variant: "destructive" },
  REJECTED: { label: "Bị từ chối", variant: "destructive" },
}

export function MyBlogsView() {
  const { data, error, isLoading } = useAuthedSWR(MY_BLOGS_KEY, fetchBlogPage)

  return (
    <section className="mx-auto w-full max-w-3xl">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h1 className="font-heading text-xl font-semibold">Blog của bạn</h1>
        <Button nativeButton={false} render={<Link href={NEW_BLOG_PATH} />} variant="raised" shape="pill">
          <PenLineIcon data-icon="inline-start" />
          Viết blog
        </Button>
      </header>

      {isLoading && (
        <div className="flex flex-col gap-3 p-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}
      {error && <p className="p-4 text-sm text-destructive">Không tải được danh sách blog.</p>}
      {data?.items.length === 0 && (
        <p className="p-6 text-center text-muted-foreground">
          Bạn chưa có bài nào. Bắt đầu bằng một công thức dài của riêng bạn.
        </p>
      )}
      <ul className="divide-y divide-border">
        {data?.items.map((item) => (
          <li key={item.id}>
            <Link href={editBlogPath(item.id)} className="flex flex-col gap-1 px-4 py-3 hover:bg-muted/40">
              <span className="flex items-center gap-2">
                <span className="truncate font-medium">{item.blog.title}</span>
                <Badge variant={STATUS_BADGES[item.status].variant}>
                  {STATUS_BADGES[item.status].label}
                </Badge>
              </span>
              {item.blog.excerpt && (
                <span className="line-clamp-2 text-sm text-muted-foreground">{item.blog.excerpt}</span>
              )}
              <span className="text-xs text-muted-foreground">{formatPostDate(item.createdAt)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
