"use client"

import Link from "next/link"
import { useState } from "react"
import { PenLineIcon, Trash2Icon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import { DeleteBlogDialog } from "@/features/blogs/components/delete-blog-dialog"
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
  return (
    <section className="mx-auto w-full max-w-3xl">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h1 className="font-heading text-xl font-semibold">Blog của bạn</h1>
        <Button nativeButton={false} render={<Link href={NEW_BLOG_PATH} />} variant="raised" shape="pill">
          <PenLineIcon data-icon="inline-start" />
          Viết blog
        </Button>
      </header>
      <MyBlogsList />
    </section>
  )
}

/** The signed-in author's blogs with their status; shared by the blogs page and the profile tab. */
export function MyBlogsList() {
  const { data, error, isLoading } = useAuthedSWR(MY_BLOGS_KEY, fetchBlogPage)

  return (
    <>
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
          <MyBlogRow key={item.id} item={item} />
        ))}
      </ul>
    </>
  )
}

interface MyBlogItem {
  id: string
  status: ApiPost["status"]
  blog: { title: string; excerpt: string }
  createdAt: string
}

function MyBlogRow({ item }: { item: MyBlogItem }) {
  const [deleting, setDeleting] = useState(false)
  const badge = STATUS_BADGES[item.status]
  return (
    <li className="flex items-start hover:bg-muted/40">
      <Link href={editBlogPath(item.id)} className="flex min-w-0 flex-1 flex-col gap-1 px-4 py-3">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium">{item.blog.title}</span>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </span>
        {item.blog.excerpt && (
          <span className="line-clamp-2 text-sm text-muted-foreground">{item.blog.excerpt}</span>
        )}
        <span className="text-xs text-muted-foreground">{formatPostDate(item.createdAt)}</span>
      </Link>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="mr-3 mt-3"
        aria-label={`Xoá blog ${item.blog.title}`}
        onClick={() => setDeleting(true)}
      >
        <Trash2Icon aria-hidden />
      </Button>
      <DeleteBlogDialog
        blogId={item.id}
        title={item.blog.title}
        open={deleting}
        onOpenChange={setDeleting}
      />
    </li>
  )
}
