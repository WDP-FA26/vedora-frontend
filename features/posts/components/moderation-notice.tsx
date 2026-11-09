"use client"

import { ShieldAlertIcon } from "lucide-react"

import { Spinner } from "@/components/ui/spinner"
import { useProcessingPost } from "@/features/posts/hooks/use-feed-posts"
import { rejectionMessage } from "@/features/posts/lib/moderation-labels"
import type { ApiPost } from "@/features/posts/schemas"

/**
 * Tells the author where an unpublished post stands: being checked, waiting
 * for an admin, or blocked and why. Only the author can load such a post.
 */
export function ModerationNotice({ post }: { post: ApiPost }) {
  if (post.status === "PROCESSING") return <CheckingNotice id={post.id} blog={post.type === "BLOG"} />

  const subject = post.type === "BLOG" ? "Blog" : "Bài viết"
  if (post.status === "PENDING_REVIEW") {
    return (
      <Notice tone="muted">
        <Spinner aria-hidden />
        {subject} đang chờ quản trị viên xem xét. Chỉ bạn thấy {subject.toLowerCase()} này cho đến khi có kết quả.
      </Notice>
    )
  }
  if (post.status === "REJECTED") {
    return (
      <Notice tone="destructive">
        <ShieldAlertIcon aria-hidden className="size-4 shrink-0" />
        {rejectionMessage(post.moderationVerdict, subject, post.moderationReason)} Chỉ bạn thấy {subject.toLowerCase()} này.
      </Notice>
    )
  }
  return null
}

/** Polls until the check finishes, so the notice turns into the result by itself. */
function CheckingNotice({ id, blog }: { id: string; blog: boolean }) {
  useProcessingPost(id)
  return (
    <Notice tone="muted">
      <Spinner aria-hidden />
      {blog ? "Blog" : "Bài viết"} đang được kiểm duyệt. Chỉ bạn thấy bài này cho đến khi xong.
    </Notice>
  )
}

function Notice({ tone, children }: { tone: "muted" | "destructive"; children: React.ReactNode }) {
  return (
    <p
      role="status"
      className={
        tone === "destructive"
          ? "mb-4 flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
          : "mb-4 flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm font-medium text-muted-foreground"
      }
    >
      {children}
    </p>
  )
}
