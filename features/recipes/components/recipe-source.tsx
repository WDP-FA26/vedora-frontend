"use client"

import { UnlinkIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PostVideo } from "@/features/admin/components/content/post-sheet"
import { useAdminPost } from "@/features/admin/hooks/use-admin-posts"

/** The post a recipe is written from: its text, videos and transcripts, beside the form. */
export function RecipeSource({
  postId,
  onUnlink,
}: {
  postId: string
  onUnlink: () => void
}) {
  const { post, error } = useAdminPost(postId)

  return (
    <aside
      aria-label="Bài đăng gốc"
      className="flex flex-col gap-4 rounded-2xl border bg-card p-4 xl:sticky xl:top-16 xl:max-h-[calc(100dvh-5rem)] xl:self-start xl:overflow-y-auto"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-sans text-sm font-medium">Bài đăng gốc</h2>
          <p className="truncate text-[0.8125rem] text-muted-foreground">
            {post
              ? `${post.author.fullName} · @${post.author.username}`
              : error
                ? "Không tải được bài đăng."
                : "Đang tải…"}
          </p>
        </div>
        <Button variant="action" size="sm" onClick={onUnlink}>
          <UnlinkIcon aria-hidden />
          Bỏ liên kết
        </Button>
      </div>

      {post ? (
        <>
          {post.body && (
            <p className="leading-6 break-words whitespace-pre-line">{post.body}</p>
          )}
          {post.media.map((item, index) => (
            <PostVideo
              key={item.id}
              media={item}
              label={
                post.media.length === 1 ? "Video" : `Video ${index + 1}/${post.media.length}`
              }
            />
          ))}
          {post.media.length === 0 && (
            <p className="text-muted-foreground">Bài đăng này không có video.</p>
          )}
        </>
      ) : (
        !error && <Skeleton className="aspect-video w-full" aria-hidden />
      )}
    </aside>
  )
}
