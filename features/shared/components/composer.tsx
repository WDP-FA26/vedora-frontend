"use client"

import { useId, useRef, useState } from "react"
import {
  CalendarClockIcon,
  ClapperboardIcon,
  FileTextIcon,
  GlobeIcon,
  ImageIcon,
  SmileIcon,
  UtensilsCrossedIcon,
  XIcon,
} from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useUpsertFeedPost } from "@/features/posts/hooks/use-feed-posts"
import { useVideoUpload } from "@/features/posts/hooks/use-video-upload"
import {
  ApiError,
  MAX_POST_LENGTH,
  createPost,
} from "@/features/posts/lib/posts-api"

const VIDEO_TOOL = "Tải video lên"

const tools = [
  { label: "Thêm ảnh", icon: ImageIcon },
  { label: VIDEO_TOOL, icon: ClapperboardIcon },
  { label: "Đính kèm công thức", icon: UtensilsCrossedIcon },
  { label: "Viết bài blog", icon: FileTextIcon },
  { label: "Lên lịch đăng", icon: CalendarClockIcon, desktopOnly: true },
  { label: "Thêm biểu tượng cảm xúc", icon: SmileIcon, desktopOnly: true },
]

export function Composer({
  className,
  autoFocus,
  onPosted,
}: {
  className?: string
  autoFocus?: boolean
  /** Called after the post was created on the API. */
  onPosted?: () => void
}) {
  const [text, setText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { author, accessToken } = useAuth()
  const { upload, start, remove, release } = useVideoUpload()
  const upsertFeedPost = useUpsertFeedPost()
  const fileInput = useRef<HTMLInputElement>(null)
  const inputId = useId()

  const remaining = MAX_POST_LENGTH - text.length
  const empty = text.trim().length === 0
  const uploading = upload.status === "uploading"
  const hasVideo = upload.status === "uploaded"
  const canSubmit =
    (!empty || hasVideo) && remaining >= 0 && !uploading && !submitting

  async function submit() {
    if (!canSubmit || !accessToken) return
    setSubmitting(true)
    setError(null)
    try {
      const post = await createPost(accessToken, {
        body: text.trim() || undefined,
        mediaIds: hasVideo ? [upload.mediaId] : undefined,
      })
      release()
      setText("")
      await upsertFeedPost(post)
      onPosted?.()
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status < 500
          ? cause.message
          : "Không đăng được bài. Thử lại nhé."
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      className={cn("flex gap-3 border-b border-border px-4 py-4 sm:px-5", className)}
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      {author && <AuthorAvatar author={author} size="lg" className="mt-0.5" />}
      <div className="min-w-0 flex-1">
        <label htmlFor={inputId} className="sr-only">
          Bài viết mới
        </label>
        <textarea
          id={inputId}
          autoFocus={autoFocus}
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={2}
          placeholder="Chia sẻ công thức, câu chuyện mùa vụ hoặc video nấu ăn…"
          className="field-sizing-content block max-h-80 min-h-14 w-full resize-none bg-transparent py-2 text-[1.0625rem] leading-relaxed outline-none placeholder:text-muted-foreground"
        />

        {(upload.status === "uploading" || upload.status === "uploaded") && (
          <div className="relative mb-3 overflow-hidden rounded-2xl border border-border bg-black">
            <video
              src={upload.previewUrl}
              muted
              playsInline
              controls={hasVideo}
              className="max-h-72 w-full object-contain"
            />
            <Button
              type="button"
              variant="raised"
              size="icon"
              shape="pill"
              aria-label="Bỏ video"
              onClick={remove}
              className="absolute top-2 right-2"
            >
              <XIcon aria-hidden />
            </Button>
            {uploading && (
              <div className="absolute inset-x-0 bottom-0 bg-card/90 px-3 py-2">
                <Progress
                  value={Math.round(upload.progress)}
                  aria-label="Tiến trình tải video lên"
                >
                  <span className="text-xs font-semibold tabular-nums">
                    Đang tải lên {Math.round(upload.progress)}%
                  </span>
                </Progress>
              </div>
            )}
          </div>
        )}

        {(error || upload.status === "error") && (
          <p role="alert" className="mb-2 text-sm font-medium text-destructive">
            {error ?? (upload.status === "error" ? upload.message : null)}
          </p>
        )}

        <p className="flex items-center gap-1.5 border-b border-border pb-3 text-xs font-semibold text-primary">
          <GlobeIcon aria-hidden className="size-3.5" />
          Mọi người đều có thể xem và trả lời
        </p>
        <div className="flex items-center justify-between gap-2 pt-2.5">
          <input
            ref={fileInput}
            type="file"
            accept="video/*"
            hidden
            aria-label={VIDEO_TOOL}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file) void start(file)
            }}
          />
          <div className="-ml-2 flex items-center">
            {tools.map(({ label, icon: Icon, desktopOnly }) => (
              <Tooltip key={label}>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="tool"
                      size="icon"
                      shape="pill"
                      className={cn(desktopOnly && "max-sm:hidden")}
                      disabled={
                        label === VIDEO_TOOL && (uploading || hasVideo || submitting)
                      }
                      onClick={
                        label === VIDEO_TOOL
                          ? () => fileInput.current?.click()
                          : undefined
                      }
                    />
                  }
                  aria-label={label}
                >
                  <Icon aria-hidden strokeWidth={1.75} />
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {!empty && (
              <span
                aria-live="polite"
                className={cn(
                  "text-xs font-medium text-muted-foreground tabular-nums",
                  remaining < 20 && "text-[oklch(0.55_0.13_70)]",
                  remaining < 0 && "text-destructive"
                )}
              >
                {remaining}
                <span className="sr-only"> ký tự còn lại</span>
              </span>
            )}
            <Button type="submit" disabled={!canSubmit} size="pill" shape="pill">
              {submitting ? "Đang đăng…" : "Đăng"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
