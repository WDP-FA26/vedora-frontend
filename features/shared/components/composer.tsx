"use client"

import { useRef } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  ClapperboardIcon,
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
import { MediaGrid } from "@/features/posts/components/media-grid"
import { VideoPreview } from "@/features/posts/components/video-preview"
import { useMediaUploads } from "@/features/posts/hooks/use-media-uploads"
import { ApiError, createPost } from "@/features/posts/lib/posts-api"
import {
  MAX_POST_LENGTH,
  MAX_POST_MEDIA,
  postFormSchema,
  type PostFormValues,
} from "@/features/posts/schemas"

const VIDEO_TOOL = "Tải video lên"

/** What leaving the composer would throw away. */
export type ComposerDraft = { hasText: boolean; mediaCount: number }

export const EMPTY_DRAFT: ComposerDraft = { hasText: false, mediaCount: 0 }

const tools = [
  { label: "Thêm ảnh", icon: ImageIcon },
  { label: VIDEO_TOOL, icon: ClapperboardIcon },
  { label: "Đính kèm công thức", icon: UtensilsCrossedIcon },
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
  onDraftChange,
}: {
  className?: string
  autoFocus?: boolean
  /** Called after the post was created on the API. */
  onPosted?: () => void
  /**
   * Called when the draft gains or loses text or attachments. Unmounting the
   * composer discards the draft (and deletes its uploads), so a parent can
   * confirm before closing it.
   */
  onDraftChange?: (draft: ComposerDraft) => void
}) {
  const { author, accessToken } = useAuth()
  const upsertFeedPost = useUpsertFeedPost()
  const fileInput = useRef<HTMLInputElement>(null)

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues: { body: "", mediaIds: [] },
  })
  const { isSubmitting, errors } = form.formState
  const body = useWatch({ control: form.control, name: "body" })

  const { uploads, error: uploadError, add, remove, release } = useMediaUploads({
    onChange: (ids, count) => {
      form.setValue("mediaIds", ids)
      onDraftChange?.({
        hasText: form.getValues("body").trim() !== "",
        mediaCount: count,
      })
    },
  })

  const remaining = MAX_POST_LENGTH - body.length
  const uploading = uploads.some((item) => item.mediaId === null)
  const canSubmit =
    (body.trim() !== "" || uploads.length > 0) &&
    remaining >= 0 &&
    !uploading &&
    !isSubmitting

  async function onSubmit(values: PostFormValues) {
    if (!accessToken) return
    try {
      const post = await createPost(accessToken, {
        body: values.body.trim() || undefined,
        mediaIds: values.mediaIds.length > 0 ? values.mediaIds : undefined,
      })
      release()
      form.reset()
      onDraftChange?.(EMPTY_DRAFT)
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
                onChange={(event) => {
                  field.onChange(event)
                  onDraftChange?.({
                    hasText: event.target.value.trim() !== "",
                    mediaCount: uploads.length,
                  })
                }}
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

        {uploads.length > 0 && (
          <MediaGrid className="mb-3">
            {uploads.map((item, index) => (
              <div key={item.key} className="relative size-full">
                <VideoPreview
                  src={item.previewUrl}
                  label={`Xem trước video ${index + 1}`}
                  fill={uploads.length > 1}
                />
                <Button
                  type="button"
                  variant="raised"
                  size="icon"
                  shape="pill"
                  aria-label={`Bỏ video ${index + 1}`}
                  onClick={() => remove(item.key)}
                  className="absolute top-2 right-2"
                >
                  <XIcon aria-hidden />
                </Button>
                {item.mediaId === null && (
                  <div className="absolute inset-x-0 bottom-0 bg-card/90 px-3 py-2">
                    <Progress
                      value={Math.round(item.progress)}
                      aria-label={`Tiến trình tải video ${index + 1} lên`}
                    >
                      <span className="text-xs font-semibold tabular-nums">
                        Đang tải lên {Math.round(item.progress)}%
                      </span>
                    </Progress>
                  </div>
                )}
              </div>
            ))}
          </MediaGrid>
        )}

        {uploadError && <FieldError className="mb-2">{uploadError}</FieldError>}
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
            multiple
            hidden
            aria-label={VIDEO_TOOL}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? [])
              event.target.value = ""
              if (files.length > 0) void add(files)
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
                        (uploads.length >= MAX_POST_MEDIA || isSubmitting)
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
