"use client"

import Link from "next/link"
import MuxPlayer from "@mux/mux-player-react/lazy"
import { useState } from "react"
import { ClapperboardIcon, EllipsisIcon, SproutIcon } from "lucide-react"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PostCard } from "@/features/home/components/post-card"
import { postPath } from "@/features/posts/posts-cache"
import type { ApiPost } from "@/features/posts/schemas"
import { formatCount } from "@/features/shared/lib/format"
import { toFeedPost } from "@/features/posts/lib/to-feed-post"
import { useProfilePosts } from "@/features/profiles/hooks/use-profile-posts"

/** The published posts of profile `id`, under the profile header. */
export function ProfilePosts({ id, count }: { id: string; count: number }) {
  const { user } = useAuth()
  const isOwn = user?.id === id
  const [tab, setTab] = useState<"posts" | "videos">("posts")
  const activeTab = isOwn ? tab : "posts"
  const { posts, error, isLoading, retry } = useProfilePosts(id)
  const videos = posts.filter((post) => post.media.some((media) => media.type === "VIDEO"))

  return (
    <section aria-labelledby="profile-posts-title" className="border-t-8 border-muted/60">
      <h2 id="profile-posts-title" className="sr-only">Nội dung hồ sơ</h2>
      <div className="flex items-stretch gap-5 border-b border-border px-4 sm:px-5">
        <button type="button" onClick={() => setTab("posts")} aria-current={activeTab === "posts" ? "page" : undefined} className="inline-flex items-center gap-2 border-b-2 border-transparent py-3 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring aria-[current=page]:border-primary aria-[current=page]:text-primary">
          Bài viết <span className="font-medium tabular-nums">{formatCount(count)}</span>
        </button>
        {isOwn && <button type="button" onClick={() => setTab("videos")} aria-current={activeTab === "videos" ? "page" : undefined} className="inline-flex items-center gap-2 border-b-2 border-transparent py-3 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring aria-[current=page]:border-primary aria-[current=page]:text-primary"><ClapperboardIcon aria-hidden className="size-4" /> Video của tôi</button>}
      </div>

      {activeTab === "videos" && <div className="border-b border-border bg-secondary/30 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="rounded-full bg-primary px-3 py-1.5 font-semibold text-primary-foreground">Đã đăng</span>
          {["Bản nháp", "Chờ duyệt", "Cần chỉnh sửa", "Bị ẩn"].map((status) => <span key={status} title={`${status} · Sắp có`} aria-disabled="true" className="rounded-full border border-border bg-card px-3 py-1.5 text-muted-foreground opacity-70">{status} · Sắp có</span>)}
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">Hiển thị video trong các bài viết gần đây của bạn.</p>
      </div>}

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
      ) : activeTab === "videos" ? (
        videos.length === 0 ? <Empty><EmptyHeader><EmptyMedia variant="icon"><ClapperboardIcon aria-hidden /></EmptyMedia><EmptyTitle>Chưa có video đã đăng</EmptyTitle><EmptyDescription>Video đã sẵn sàng sẽ hiển thị tại đây.</EmptyDescription></EmptyHeader></Empty> :
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">{videos.map((post) => <MyVideoCard key={post.id} post={post} />)}</div>
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

function MyVideoCard({ post }: { post: ApiPost }) {
  const video = post.media.find((media) => media.type === "VIDEO")
  const title = post.body?.split("\n").find((line) => line.trim())?.trim() || "Video hướng dẫn"
  const date = post.publishedAt ?? post.createdAt
  const formattedDate = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(date))
  const status = post.status === "PUBLISHED" ? "Đã đăng" : post.status === "PROCESSING" ? "Đang xử lý" : "Lỗi xử lý"

  return <article className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
    <div className="aspect-video overflow-hidden bg-secondary">
      {video?.playbackId && video.status === "READY" ? <MuxPlayer playbackId={video.playbackId} streamType="on-demand" accentColor="var(--primary)" title={title} className="block h-full w-full bg-black [--media-object-fit:contain]" /> : <div className="flex h-full items-center justify-center text-primary"><ClapperboardIcon aria-hidden className="size-9" /></div>}
    </div>
    <div className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="line-clamp-2 text-sm font-bold leading-5">{title}</h3><p className="mt-1 text-xs text-muted-foreground">{post.publishedAt ? "Ngày đăng" : "Ngày tạo"}: {formattedDate}</p></div><DropdownMenu><DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label={`Tùy chọn cho ${title}`} />}><EllipsisIcon aria-hidden /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem disabled>Chỉnh sửa · Sắp có</DropdownMenuItem><DropdownMenuItem disabled>Xóa bài viết · Sắp có</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
      <div className="flex items-center justify-between gap-2"><Badge variant="secondary">{status}</Badge>{post.status === "PUBLISHED" && <Link href={postPath(post.id)} className="rounded-sm text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">Xem bài viết</Link>}</div>
    </div>
  </article>
}
