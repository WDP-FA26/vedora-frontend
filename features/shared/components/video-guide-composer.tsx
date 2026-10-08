"use client"

import { useEffect, useRef, useState } from "react"
import {
  BookOpenIcon,
  CheckIcon,
  ChevronDownIcon,
  ClapperboardIcon,
  EyeIcon,
  GlobeIcon,
  LockKeyholeIcon,
  RotateCcwIcon,
  SmileIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"
import { cn } from "cn"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useUpsertFeedPost } from "@/features/posts/hooks/use-feed-posts"
import { useMediaUploads } from "@/features/posts/hooks/use-media-uploads"
import { createPost } from "@/features/posts/lib/posts-api"
import { VideoPreview } from "@/features/posts/components/video-preview"
import {
  MAX_POST_LENGTH,
  MAX_VIDEO_DURATION_SEC,
  postFormSchema,
  type ApiPost,
} from "@/features/posts/schemas"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { ApiError } from "@/features/shared/lib/api-client"
import type { ComposerDraft } from "./composer"

type GuideTemplate = {
  id: string
  name: string
  headings: readonly string[]
}

const TEMPLATES: readonly GuideTemplate[] = [
  {
    id: "step-by-step",
    name: "Hướng dẫn từng bước",
    headings: ["Tên món", "Giới thiệu", "Nguyên liệu", "Các bước thực hiện", "Mẹo khi nấu"],
  },
  {
    id: "quick-vegetarian",
    name: "Món chay nhanh",
    headings: ["Tên món", "Thời gian chuẩn bị và nấu", "Nguyên liệu chính", "Cách làm", "Mẹo tiết kiệm thời gian"],
  },
  {
    id: "kitchen-tip",
    name: "Mẹo bếp chay",
    headings: ["Mẹo muốn chia sẻ", "Chuẩn bị", "Cách thực hiện", "Lưu ý"],
  },
  {
    id: "food-story",
    name: "Câu chuyện món ăn",
    headings: ["Tên món", "Câu chuyện của món", "Điểm đặc biệt", "Cách làm", "Lời nhắn"],
  },
] as const

const ALL_HEADINGS = new Set(TEMPLATES.flatMap((template) => template.headings))

function scaffold(template: GuideTemplate) {
  return template.headings.map((heading) => `${heading}:`).join("\n")
}

/** Blank template labels are never considered finished writing. */
function filledDescription(value: string) {
  return value.split("\n").filter((line) => {
    const trimmed = line.trim()
    if (!trimmed) return true
    const separator = trimmed.indexOf(":")
    if (separator < 0 || !ALL_HEADINGS.has(trimmed.slice(0, separator).trim())) return true
    return trimmed.slice(separator + 1).trim().length > 0
  }).join("\n").trim()
}

function hasDescriptionContent(value: string) {
  return filledDescription(value).length > 0
}

function composeBody(title: string, description: string) {
  return [title.trim(), filledDescription(description)].filter(Boolean).join("\n\n")
}

function durationLabel(seconds: number | null) {
  if (seconds === null) return null
  const rounded = Math.floor(seconds)
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`
}

export function VideoGuideComposer({
  autoFocus,
  onPosted,
  onDraftChange,
  onSubmittingChange,
}: {
  autoFocus?: boolean
  onPosted?: (post: ApiPost) => void
  onDraftChange?: (draft: ComposerDraft) => void
  onSubmittingChange?: (submitting: boolean) => void
}) {
  const { author, accessToken } = useAuth()
  const upsertFeedPost = useUpsertFeedPost()
  const inputRef = useRef<HTMLInputElement>(null)
  const draftTextRef = useRef({ title: "", description: "" })
  const sawReplacementRef = useRef(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [mediaIds, setMediaIds] = useState<string[]>([])
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; description?: string; video?: string }>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [preview, setPreview] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [pendingTemplate, setPendingTemplate] = useState<GuideTemplate | null>(null)
  const [undoDescription, setUndoDescription] = useState<string | null>(null)
  const [replaceOriginalKey, setReplaceOriginalKey] = useState<string | null>(null)

  const { uploads, error: uploadError, add, remove, release, retry } = useMediaUploads({
    onChange: (ids, count) => {
      setMediaIds(ids)
      const draftText = draftTextRef.current
      onDraftChange?.({
        hasText: Boolean(draftText.title || draftText.description),
        mediaCount: count,
      })
    },
  })

  const currentBody = composeBody(title, description)
  const remaining = MAX_POST_LENGTH - currentBody.length
  const readyUpload = uploads.length === 1 && uploads[0].status === "ready"
  const canSubmit = !isSubmitting && !replaceOriginalKey && !uploads.some((upload) => upload.status === "uploading")

  useEffect(() => {
    if (!replaceOriginalKey) return
    const replacement = uploads.find((upload) => upload.key !== replaceOriginalKey)
    if (replacement) sawReplacementRef.current = true
    const originalStillPresent = uploads.some((upload) => upload.key === replaceOriginalKey)
    if (replacement?.status !== "ready" && originalStillPresent && !(sawReplacementRef.current && !replacement)) return
    const timer = window.setTimeout(() => {
      if (replacement?.status === "ready") remove(replaceOriginalKey)
      setReplaceOriginalKey(null)
      sawReplacementRef.current = false
    }, 0)
    return () => window.clearTimeout(timer)
  }, [replaceOriginalKey, uploads, remove])

  function updateText(nextTitle: string, nextDescription: string) {
    draftTextRef.current = { title: nextTitle, description: nextDescription }
    setTitle(nextTitle)
    setDescription(nextDescription)
    setFieldErrors({})
    setSubmitError(null)
    onDraftChange?.({
      hasText: Boolean(nextTitle || nextDescription),
      mediaCount: uploads.length,
    })
  }

  function applyTemplate(template: GuideTemplate) {
    setUndoDescription(description)
    updateText(title, scaffold(template))
    setTemplateOpen(false)
    setPendingTemplate(null)
    setPreview(false)
  }

  function chooseTemplate(template: GuideTemplate) {
    setTemplateOpen(false)
    if (description.trim()) setPendingTemplate(template)
    else applyTemplate(template)
  }

  function selectVideo() {
    inputRef.current?.click()
  }

  function addVideo(files: File[]) {
    const file = files[0]
    if (!file) return
    if (!file.type.startsWith("video/")) {
      setFieldErrors((previous) => ({ ...previous, video: "Hãy chọn tệp video." }))
      return
    }
    setSubmitError(null)
    setFieldErrors((previous) => ({ ...previous, video: undefined }))
    if (uploads.length === 1) {
      sawReplacementRef.current = false
      setReplaceOriginalKey(uploads[0].key)
    }
    void add([file])
  }

  function discardUpload(key: string) {
    sawReplacementRef.current = false
    if (key === replaceOriginalKey) setReplaceOriginalKey(null)
    else if (replaceOriginalKey) setReplaceOriginalKey(null)
    remove(key)
  }

  function validate() {
    const next: typeof fieldErrors = {}
    if (!title.trim()) next.title = "Nhập tiêu đề video."
    if (!hasDescriptionContent(description)) next.description = "Viết nội dung hướng dẫn; các đề mục mẫu chưa được tính là nội dung."
    if (currentBody.length > MAX_POST_LENGTH) {
      next.description = `Tiêu đề và mô tả cộng lại tối đa ${MAX_POST_LENGTH} ký tự.`
    }
    if (uploads.length === 0) next.video = "Chọn một video hướng dẫn."
    else if (!readyUpload || mediaIds.length !== 1) next.video = "Chờ video tải xong hoặc thử lại khi tải lỗi."
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || !validate()) return
    if (!accessToken) {
      setSubmitError("Phiên đăng nhập đã hết hạn. Nội dung vẫn ở đây, hãy đăng nhập lại.")
      return
    }
    const values = postFormSchema.safeParse({ body: currentBody, mediaIds })
    if (!values.success) {
      setSubmitError("Bài viết chưa hợp lệ theo giới hạn hiện tại. Hãy kiểm tra nội dung và video.")
      return
    }

    onSubmittingChange?.(true)
    setIsSubmitting(true)
    setSubmitError(null)
    let postedPost: ApiPost | null = null
    try {
      // The API accepts only type POST, body and media IDs. Guide structure is plain text.
      const post = await createPost(accessToken, {
        body: values.data.body.trim(),
        mediaIds: values.data.mediaIds,
      })
      if (post.status === "FAILED") {
        setSubmitError("Hệ thống chưa xử lý được video. Nội dung vẫn được giữ để bạn thử lại.")
        return
      }
      if (post.status === "PUBLISHED") void upsertFeedPost(post).catch(() => undefined)
      release()
      updateText("", "")
      onDraftChange?.({ hasText: false, mediaCount: 0 })
      postedPost = post
    } catch (error) {
      setSubmitError(
        error instanceof ApiError && error.status === 401
          ? "Phiên đăng nhập đã hết hạn. Nội dung vẫn ở đây, hãy đăng nhập lại."
          : "Không đăng được video. Nội dung và video còn hợp lệ vẫn được giữ để bạn thử lại."
      )
    } finally {
      setIsSubmitting(false)
      onSubmittingChange?.(false)
    }
    if (postedPost) onPosted?.(postedPost)
  }

  return (
    <form noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col bg-card">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 sm:py-6">
        {preview ? (
          <section aria-label="Xem trước video" className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-[0.13em] text-primary uppercase">Bản xem trước</p>
                <h3 className="mt-1 text-lg font-bold">Video của bạn</h3>
              </div>
              <Button type="button" variant="outline" size="sm" shape="pill" onClick={() => setPreview(false)}>
                Tiếp tục chỉnh sửa
              </Button>
            </div>
            <div className="overflow-hidden rounded-3xl border border-border bg-background shadow-sm">
              <div className="flex items-center gap-3 px-4 py-4">
                {author && <AuthorAvatar author={author} size="lg" />}
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{author?.name ?? "Bạn"}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <GlobeIcon aria-hidden className="size-3.5" /> Công khai
                  </p>
                </div>
              </div>
              {uploads[0] && <VideoPreview src={uploads[0].previewUrl} label="Xem trước video đang soạn" />}
              <div className="space-y-2 px-4 py-4">
                <h4 className="text-lg font-bold">{title.trim() || "Tiêu đề video"}</h4>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
                  {filledDescription(description) || "Nội dung hướng dẫn sẽ hiển thị ở đây."}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Xem trước chỉ hiển thị nội dung đang soạn, chưa gửi bài.</p>
          </section>
        ) : (
          <div className="space-y-6">
            {author && (
              <div className="flex items-center gap-3">
                <AuthorAvatar author={author} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{author.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Popover>
                      <PopoverTrigger
                        render={<Button type="button" variant="outline" size="xs" shape="pill" />}
                        aria-label="Chọn đối tượng xem"
                      >
                        <GlobeIcon aria-hidden className="size-3.5" /> Công khai <ChevronDownIcon aria-hidden className="size-3.5" />
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))]">
                        <PopoverTitle>Đối tượng xem</PopoverTitle>
                        <div className="flex items-start gap-3 rounded-2xl bg-primary/8 px-3 py-3">
                          <GlobeIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                          <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Công khai</p><p className="text-xs text-muted-foreground">Mọi người xem được sau khi bài sẵn sàng.</p></div>
                          <CheckIcon aria-hidden className="size-4 shrink-0 text-primary" />
                        </div>
                        <div className="flex items-start gap-3 px-3 py-3 text-muted-foreground" aria-disabled="true">
                          <UsersIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
                          <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Người theo dõi <span className="text-xs font-normal">· Sắp có</span></p><p className="text-xs">Chỉ người theo dõi xem được sau khi bài sẵn sàng.</p></div>
                        </div>
                        <div className="flex items-start gap-3 px-3 py-3 text-muted-foreground" aria-disabled="true">
                          <LockKeyholeIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
                          <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Chỉ mình tôi <span className="text-xs font-normal">· Sắp có</span></p><p className="text-xs">Chỉ bạn xem trong giao diện; quản trị viên có thẩm quyền vẫn có thể truy cập.</p></div>
                        </div>
                        <p className="border-t border-border/70 px-2 pt-2 text-xs text-muted-foreground">Đối tượng xem và trạng thái xử lý video là hai thông tin riêng.</p>
                      </PopoverContent>
                    </Popover>
                    <Button type="button" variant="outline" size="xs" shape="pill" disabled title="Cảm xúc chưa thể lưu cùng bài viết">
                      <SmileIcon aria-hidden className="size-3.5" /> Cảm xúc · Sắp có
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h3 className="text-base font-bold">Nội dung hướng dẫn</h3><p className="text-xs text-muted-foreground">Tiêu đề và mô tả sẽ cùng xuất hiện trong nội dung bài.</p></div>
                <Popover open={templateOpen} onOpenChange={setTemplateOpen}>
                  <PopoverTrigger render={<Button type="button" variant="outline" size="sm" shape="pill" />}>
                    <BookOpenIcon aria-hidden className="size-4" /> Chọn mẫu <ChevronDownIcon aria-hidden className="size-4" />
                  </PopoverTrigger>
                  <PopoverContent align="end" className="max-h-[min(26rem,60dvh)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto">
                    <PopoverTitle>Chọn mẫu nội dung</PopoverTitle>
                    {TEMPLATES.map((template) => (
                      <button key={template.id} type="button" onClick={() => chooseTemplate(template)} className="w-full rounded-2xl px-3 py-3 text-left transition-colors hover:bg-primary/7 focus-visible:outline-2 focus-visible:outline-primary">
                        <span className="block text-sm font-semibold">{template.name}</span>
                        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{template.headings.join(" · ")}</span>
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
              {undoDescription !== null && (
                <Button type="button" variant="ghost" size="sm" onClick={() => { updateText(title, undoDescription); setUndoDescription(null) }}>
                  <RotateCcwIcon aria-hidden className="size-4" /> Hoàn tác thay mẫu
                </Button>
              )}
              <div>
                <label htmlFor="video-guide-title" className="mb-1.5 block text-sm font-semibold">Tiêu đề video</label>
                <input id="video-guide-title" value={title} autoFocus={autoFocus} onChange={(event) => updateText(event.target.value, description)} aria-invalid={Boolean(fieldErrors.title)} aria-describedby={fieldErrors.title ? "video-guide-title-error" : undefined} placeholder="Ví dụ: Cách làm bún riêu chay" className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15" />
                {fieldErrors.title && <p id="video-guide-title-error" className="mt-1 text-xs text-destructive">{fieldErrors.title}</p>}
              </div>
              <div>
                <label htmlFor="video-guide-description" className="mb-1.5 block text-sm font-semibold">Mô tả và các bước hướng dẫn</label>
                <textarea id="video-guide-description" value={description} onChange={(event) => updateText(title, event.target.value)} aria-invalid={Boolean(fieldErrors.description)} aria-describedby={fieldErrors.description ? "video-guide-description-error" : undefined} rows={7} placeholder="Giới thiệu món ăn, nguyên liệu, cách thực hiện và mẹo của bạn…" className="block min-h-44 w-full resize-y rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/80 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15" />
                {fieldErrors.description && <p id="video-guide-description-error" className="mt-1 text-xs text-destructive">{fieldErrors.description}</p>}
                <p className={cn("mt-1 text-right text-xs tabular-nums text-muted-foreground", remaining < 20 && "font-semibold text-amber-700", remaining < 0 && "text-destructive")} aria-live="polite">{currentBody.length}/{MAX_POST_LENGTH} ký tự</p>
              </div>
            </div>

            <section aria-labelledby="video-guide-upload-label" className="space-y-3">
              <div><h3 id="video-guide-upload-label" className="text-base font-bold">Video hướng dẫn</h3><p className="text-xs text-muted-foreground">Video tối đa {MAX_VIDEO_DURATION_SEC / 60} phút theo giới hạn hiện tại.</p></div>
              <input ref={inputRef} type="file" accept="video/*" hidden aria-label="Chọn video hướng dẫn nấu ăn" onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; addVideo(files) }} />
              {uploads.length === 0 ? (
                <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!isSubmitting) addVideo(Array.from(event.dataTransfer.files)) }} className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-primary/35 bg-primary/5 px-4 py-5 text-center">
                  <ClapperboardIcon aria-hidden className="size-8 text-primary" />
                  <p className="mt-2 text-sm font-bold">Thêm video hướng dẫn nấu ăn</p>
                  <p className="mt-1 text-xs text-muted-foreground">Kéo thả video vào đây hoặc chọn từ thiết bị.</p>
                  <Button type="button" variant="outline" size="sm" shape="pill" onClick={selectVideo} className="mt-3">Chọn video</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {uploads.map((upload) => (
                    <div key={upload.key} className="overflow-hidden rounded-2xl border border-border bg-background">
                      <VideoPreview src={upload.previewUrl} label={`Xem trước ${upload.fileName}`} />
                      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-3">
                        <div className="min-w-0"><p className="max-w-64 truncate text-sm font-semibold" title={upload.fileName}>{upload.fileName}</p><p className="text-xs text-muted-foreground">{durationLabel(upload.durationSec) ?? "Chưa đọc được thời lượng"} · {upload.status === "ready" ? "Đã tải lên" : upload.status === "failed" ? "Tải lên thất bại" : "Đang tải lên"}</p></div>
                        <div className="flex items-center gap-1">
                          {upload.status === "failed" && <Button type="button" variant="outline" size="sm" shape="pill" onClick={() => void retry(upload.key)}>Thử lại</Button>}
                          <Button type="button" variant="ghost" size="icon" shape="pill" aria-label={`Xóa ${upload.fileName}`} onClick={() => discardUpload(upload.key)} disabled={isSubmitting}><XIcon aria-hidden className="size-4" /></Button>
                        </div>
                      </div>
                      {upload.status === "uploading" && <div className="px-3 pb-3"><Progress value={Math.round(upload.progress)} aria-label={`Tiến trình tải ${upload.fileName}`}><span className="text-xs tabular-nums">Đang tải lên {Math.round(upload.progress)}%</span></Progress></div>}
                      {upload.status === "failed" && <p className="px-3 pb-3 text-xs text-destructive">{upload.error ?? "Tải video lên thất bại. Bạn có thể thử lại."}</p>}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" shape="pill" onClick={selectVideo} disabled={isSubmitting || uploads.length > 1}>{replaceOriginalKey ? "Chọn video khác" : "Thay video"}</Button>
                  {replaceOriginalKey && <p className="text-xs text-muted-foreground">Video cũ được giữ cho đến khi video mới tải lên xong.</p>}
                </div>
              )}
              {(fieldErrors.video || uploadError) && <FieldError>{fieldErrors.video ?? uploadError}</FieldError>}
            </section>

            <details className="group rounded-2xl border border-border/80 bg-background/60 px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold [&::-webkit-details-marker]:hidden"><span>Thông tin món ăn</span><ChevronDownIcon aria-hidden className="size-4 transition-transform group-open:rotate-180" /></summary>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Bạn có thể viết tên món, khẩu phần, thời gian, nguyên liệu và các bước trong mô tả hoặc chọn một mẫu ở trên.</p>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-muted-foreground">{["Tên món", "Nhóm món", "Số khẩu phần", "Thời gian chuẩn bị và nấu", "Nguyên liệu, định lượng, đơn vị", "Các bước thực hiện"].map((field) => <span key={field} className="rounded-full border border-border px-2.5 py-1">{field}</span>)}</div>
            </details>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border/70 bg-card px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7 sm:pb-5">
        {submitError && <FieldError className="mb-3">{submitError}</FieldError>}
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="lg" shape="pill" onClick={() => setPreview((value) => !value)} disabled={isSubmitting} className="shrink-0"><EyeIcon aria-hidden className="size-4" /> {preview ? "Chỉnh sửa" : "Xem trước"}</Button>
          <Button type="submit" size="lg" shape="pill" disabled={!canSubmit} className="min-w-0 flex-1">{isSubmitting && <Spinner aria-hidden />}{isSubmitting ? "Đang gửi…" : "Đăng video"}</Button>
        </div>
      </div>

      <AlertDialog open={Boolean(pendingTemplate)} onOpenChange={(open) => { if (!open) setPendingTemplate(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Thay mẫu nội dung?</AlertDialogTitle><AlertDialogDescription>Mô tả hiện tại sẽ được thay bằng các đề mục của mẫu mới. Bạn có thể hoàn tác ngay sau khi thay.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Giữ nội dung</AlertDialogCancel><AlertDialogAction onClick={() => { if (pendingTemplate) applyTemplate(pendingTemplate) }}>Thay mẫu</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}
