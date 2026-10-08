"use client"

import { useRef, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ClapperboardIcon, GlobeIcon, PlusIcon, XIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
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
import { createPost } from "@/features/posts/lib/posts-api"
import { ApiError } from "@/features/shared/lib/api-client"
import {
  MAX_POST_LENGTH,
  MAX_POST_MEDIA,
  MAX_VIDEO_DURATION_SEC,
  postFormSchema,
  type ApiPost,
  type PostFormValues,
} from "@/features/posts/schemas"
import { VideoGuideComposer } from "./video-guide-composer"

/** What leaving the composer would throw away. */
export type ComposerDraft = { hasText: boolean; mediaCount: number }

export const EMPTY_DRAFT: ComposerDraft = { hasText: false, mediaCount: 0 }

function submitErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Phiên đăng nhập đã hết hạn. Nội dung vẫn ở đây, hãy đăng nhập lại."
    }
    switch (error.code) {
      case "MEDIA_UNAVAILABLE":
        return "Video này không dùng được nữa. Hãy tải lại video khác."
      case "EMPTY_POST":
        return "Viết vài dòng hoặc thêm video."
    }
  }
  return "Không gửi được bài viết. Nội dung của bạn vẫn ở đây, hãy thử lại."
}

type ComposerProps = {
  mode?: "post" | "video"
  autoFocus?: boolean
  showVideoPickerInitially?: boolean
  onPosted?: (post: ApiPost) => void
  onDraftChange?: (draft: ComposerDraft) => void
  onSubmittingChange?: (submitting: boolean) => void
}

export function Composer({ mode = "post", ...props }: ComposerProps) {
  if (mode === "video") {
    return <VideoGuideComposer {...props} />
  }
  return <ShortPostComposer {...props} />
}

function ShortPostComposer({
  autoFocus,
  showVideoPickerInitially = false,
  onPosted,
  onDraftChange,
  onSubmittingChange,
}: Omit<ComposerProps, "mode">) {
  const { author, accessToken } = useAuth()
  const upsertFeedPost = useUpsertFeedPost()
  const fileInput = useRef<HTMLInputElement>(null)
  const [showVideoPicker, setShowVideoPicker] = useState(showVideoPickerInitially)

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues: { body: "", mediaIds: [] },
  })
  const { isSubmitting, errors } = form.formState
  const body = useWatch({ control: form.control, name: "body" })

  const { uploads, error: uploadError, add, retry, remove, release } = useMediaUploads({
    onChange: (ids, count) => {
      form.setValue("mediaIds", ids)
      form.clearErrors("root")
      onDraftChange?.({
        hasText: form.getValues("body").length > 0,
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
    if (!accessToken) {
      form.setError("root", { message: "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại." })
      return
    }

    onSubmittingChange?.(true)
    let postedPost: ApiPost | null = null
    try {
      const post = await createPost(accessToken, {
        body: values.body.trim() || undefined,
        mediaIds: values.mediaIds.length > 0 ? values.mediaIds : undefined,
      })

      if (post.status === "FAILED") {
        form.setError("root", {
          message: "Hệ thống chưa xử lý được bài viết. Nội dung vẫn được giữ để bạn thử lại.",
        })
      } else {
        // Only a published post belongs in the public feed.
        if (post.status === "PUBLISHED") {
          void upsertFeedPost(post).catch(() => undefined)
        }
        release()
        form.reset()
        onDraftChange?.(EMPTY_DRAFT)
        postedPost = post
      }
    } catch (error) {
      form.setError("root", { message: submitErrorMessage(error) })
    } finally {
      onSubmittingChange?.(false)
    }
    if (postedPost) onPosted?.(postedPost)
  }

  function chooseVideos() {
    setShowVideoPicker(true)
    fileInput.current?.click()
  }

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
        {author && (
          <div className="mb-5 flex items-center gap-3">
            <AuthorAvatar author={author} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">{author.name}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <GlobeIcon aria-hidden className="size-3.5" />
                Công khai khi bài viết sẵn sàng
              </p>
            </div>
          </div>
        )}

        <Controller
          name="body"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name} className="sr-only">
                Nội dung bài viết
              </FieldLabel>
              <textarea
                {...field}
                onChange={(event) => {
                  field.onChange(event)
                  form.clearErrors("root")
                  onDraftChange?.({
                    hasText: event.target.value.length > 0,
                    mediaCount: uploads.length,
                  })
                }}
                id={field.name}
                autoFocus={autoFocus}
                aria-invalid={fieldState.invalid}
                rows={5}
                placeholder="Chia sẻ món chay, bí quyết nấu ăn hoặc câu chuyện của bạn…"
                className="field-sizing-content block min-h-36 max-h-64 w-full resize-none bg-transparent text-[1.125rem] leading-relaxed outline-none placeholder:text-muted-foreground/80"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {body.length > 0 && (
          <p
            aria-live="polite"
            className={cn(
              "mt-1 text-right text-xs tabular-nums text-muted-foreground",
              remaining < 20 && "font-semibold text-amber-700",
              remaining < 0 && "text-destructive"
            )}
          >
            {body.length}/{MAX_POST_LENGTH} ký tự
          </p>
        )}

        <input
          ref={fileInput}
          type="file"
          accept="video/*"
          multiple
          hidden
          aria-label="Chọn video cho bài viết"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            event.target.value = ""
            if (files.length > 0) void add(files)
          }}
        />

        {(showVideoPicker || uploads.length > 0) && (
          <section aria-label="Video của bài viết" className="mt-4">
            {uploads.length === 0 ? (
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  if (!isSubmitting && event.dataTransfer.files.length > 0) {
                    void add(Array.from(event.dataTransfer.files))
                  }
                }}
                className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-4 py-5 text-center"
              >
                <ClapperboardIcon aria-hidden className="mb-2 size-7 text-primary" />
                <p className="text-sm font-semibold">Thêm video vào bài viết</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Chọn hoặc kéo video vào đây, tối đa {MAX_POST_MEDIA} video,{" "}
                  {MAX_VIDEO_DURATION_SEC / 60} phút mỗi video.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  shape="pill"
                  disabled={isSubmitting}
                  onClick={chooseVideos}
                  className="mt-3"
                >
                  Chọn video
                </Button>
              </div>
            ) : (
              <>
                <MediaGrid className="overflow-hidden rounded-2xl">
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
                        disabled={isSubmitting}
                        className="absolute top-2 right-2"
                      >
                        <XIcon aria-hidden />
                      </Button>
                      {item.status === "uploading" && (
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
                      {item.status === "failed" && (
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-card/95 px-3 py-2 text-xs">
                          <span className="min-w-0 truncate text-destructive">{item.error ?? "Tải video lên thất bại."}</span>
                          <Button type="button" variant="outline" size="xs" onClick={() => void retry(item.key)}>Thử lại</Button>
                        </div>
                      )}
                    </div>
                  ))}
                </MediaGrid>
                {uploads.length < MAX_POST_MEDIA && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    shape="pill"
                    disabled={isSubmitting}
                    onClick={chooseVideos}
                    className="mt-3"
                  >
                    <PlusIcon aria-hidden />
                    Thêm video
                  </Button>
                )}
              </>
            )}
          </section>
        )}

        {uploadError && <FieldError className="mt-3">{uploadError}</FieldError>}
      </div>

      <div className="shrink-0 border-t border-border/70 bg-card px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-5">
        {errors.root && <FieldError className="mb-3" errors={[errors.root]} />}
        <div className="mb-3 flex items-center justify-between rounded-xl border border-border px-3 py-2">
          <span className="text-sm font-semibold">Thêm vào bài viết</span>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="tool"
                  size="icon-lg"
                  shape="pill"
                  aria-label="Thêm video"
                  disabled={uploads.length >= MAX_POST_MEDIA || isSubmitting}
                  onClick={chooseVideos}
                />
              }
            >
              <ClapperboardIcon aria-hidden />
            </TooltipTrigger>
            <TooltipContent>Thêm video</TooltipContent>
          </Tooltip>
        </div>
        <Button
          type="submit"
          disabled={!canSubmit}
          size="lg"
          shape="pill"
          className="w-full"
        >
          {isSubmitting && <Spinner aria-hidden />}
          {isSubmitting ? "Đang gửi…" : "Đăng bài"}
        </Button>
      </div>
    </form>
  )
}
