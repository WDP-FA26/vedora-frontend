"use client"

import { useRef } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useUpsertFeedPost } from "@/features/posts/hooks/use-feed-posts"
import { VideoPreview } from "@/features/posts/components/video-preview"
import { useVideoUpload } from "@/features/posts/hooks/use-video-upload"
import { ApiError, createPost } from "@/features/posts/lib/posts-api"
import {
  MAX_POST_LENGTH,
  postFormSchema,
  type PostFormValues,
} from "@/features/posts/schemas"

const VIDEO_TOOL = "Tải video lên"

const tools = [
  { label: "Thêm ảnh", icon: ImageIcon },
  { label: VIDEO_TOOL, icon: ClapperboardIcon },
  { label: "Đính kèm công thức", icon: UtensilsCrossedIcon },
  { label: "Viết bài blog", icon: FileTextIcon },
  { label: "Lên lịch đăng", icon: CalendarClockIcon, desktopOnly: true },
  { label: "Thêm biểu tượng cảm xúc", icon: SmileIcon, desktopOnly: true },
]

function submitErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "MEDIA_UNAVAILABLE":
        return "Video này không dùng được nữa. Hãy tải lại video khác."
      case "EMPTY_POST":
        return "Viết vài dòng hoặc thêm video."
    }
  }
  return "Không đăng được bài. Thử lại nhé."
}

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
  const { author, accessToken } = useAuth()
  const upsertFeedPost = useUpsertFeedPost()
  const fileInput = useRef<HTMLInputElement>(null)

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues: { body: "", mediaId: undefined },
  })
  const { isSubmitting, errors } = form.formState
  const [body, mediaId] = useWatch({ control: form.control, name: ["body", "mediaId"] })

  const { upload, start, remove, release } = useVideoUpload({
    onUploaded: (id) => form.setValue("mediaId", id),
    onCleared: () => form.setValue("mediaId", undefined),
  })

  const remaining = MAX_POST_LENGTH - body.length
  const uploading = upload.status === "uploading"
  const canSubmit =
    (body.trim() !== "" || mediaId !== undefined) &&
    remaining >= 0 &&
    !uploading &&
    !isSubmitting

  async function onSubmit(values: PostFormValues) {
    if (!accessToken) return
    try {
      const post = await createPost(accessToken, {
        body: values.body.trim() || undefined,
        mediaIds: values.mediaId ? [values.mediaId] : undefined,
      })
      release()
      form.reset()
      await upsertFeedPost(post)
      onPosted?.()
    } catch (error) {
      form.setError("root", { message: submitErrorMessage(error) })
    }
  }

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
      className={cn("flex gap-3 border-b border-border px-4 py-4 sm:px-5", className)}
    >
      {author && <AuthorAvatar author={author} size="lg" className="mt-0.5" />}
      <div className="min-w-0 flex-1">
        <Controller
          name="body"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name} className="sr-only">
                Bài viết mới
              </FieldLabel>
              <textarea
                {...field}
                id={field.name}
                autoFocus={autoFocus}
                aria-invalid={fieldState.invalid}
                rows={2}
                placeholder="Chia sẻ công thức, câu chuyện mùa vụ hoặc video nấu ăn…"
                className="field-sizing-content block max-h-80 min-h-14 w-full resize-none bg-transparent py-2 text-[1.0625rem] leading-relaxed outline-none placeholder:text-muted-foreground"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {(upload.status === "uploading" || upload.status === "uploaded") && (
          <div className="relative mb-3 overflow-hidden rounded-2xl border border-border">
            <VideoPreview src={upload.previewUrl} label="Xem trước video" />
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

        {upload.status === "error" && (
          <FieldError className="mb-2">{upload.message}</FieldError>
        )}
        {errors.root && <FieldError className="mb-2" errors={[errors.root]} />}

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
                        label === VIDEO_TOOL &&
                        (upload.status === "uploading" ||
                          upload.status === "uploaded" ||
                          isSubmitting)
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
            {body.length > 0 && (
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
              {isSubmitting ? "Đang đăng…" : "Đăng"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
