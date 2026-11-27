"use client"

import { useRef, useState } from "react"
import { CheckIcon, ClapperboardIcon, PlusIcon, RotateCcwIcon, XIcon } from "lucide-react"
import useSWR, { useSWRConfig } from "swr"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useMediaUploads } from "@/features/posts/hooks/use-media-uploads"
import { rejectionMessage } from "@/features/posts/lib/moderation-labels"
import { fetchPost, updatePost } from "@/features/posts/lib/posts-api"
import { POSTS_KEY, postKey } from "@/features/posts/posts-cache"
import {
  MAX_POST_LENGTH,
  MAX_POST_MEDIA,
  MAX_POST_WORDS,
  countWords,
  type ApiMedia,
  type ApiPost,
} from "@/features/posts/schemas"
import { ApiError } from "@/features/shared/lib/api-client"

function resultToast(post: ApiPost) {
  if (post.status === "PUBLISHED") return { title: "Đã lưu chỉnh sửa" }
  if (post.status === "PENDING_REVIEW") {
    return {
      title: "Đã lưu chỉnh sửa",
      description: "Bài đang chờ quản trị viên xem xét. Chỉ bạn thấy bài cho đến khi có kết quả.",
    }
  }
  if (post.status === "REJECTED") {
    return {
      title: "Chỉnh sửa chưa được đăng",
      description: rejectionMessage(post.moderationVerdict, "Bài viết", post.moderationReason),
    }
  }
  if (post.status === "FAILED") {
    return {
      title: "Video xử lý không thành công",
      description: "Hãy sửa bài và thay video khác.",
    }
  }
  return {
    title: "Đã lưu chỉnh sửa",
    description: "Bài đang được kiểm duyệt lại, có thể mất vài phút nếu có video mới. Chỉ bạn thấy bài cho đến khi xong.",
  }
}

function failureMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "APPEAL_IN_PROGRESS") {
      return "Bài viết đang có phiếu kháng cáo mở. Hãy rút kháng cáo trước khi sửa."
    }
    if (error.code === "POST_NOT_EDITABLE") return "Bài không thể chỉnh sửa ở trạng thái hiện tại."
    if (error.code === "EMPTY_POST") return "Bài viết cần có chữ hoặc video."
    if (error.code === "MEDIA_UNAVAILABLE") return "Có video không dùng được. Hãy gỡ video đó rồi thử lại."
    if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Hãy thử lại."
  }
  return "Không lưu được chỉnh sửa. Thử lại nhé."
}

export function EditPostDialog({
  postId,
  open,
  onOpenChange,
}: {
  postId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [saving, setSaving] = useState(false)

  function handleOpenChange(next: boolean) {
    if (saving) return
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa bài viết</DialogTitle>
          <DialogDescription>
            Nội dung đã sửa sẽ được kiểm duyệt lại như bài mới. Thêm hoặc thay video có thể mất vài phút.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <EditPostForm
            postId={postId}
            saving={saving}
            onSavingChange={setSaving}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function EditPostForm({
  postId,
  saving,
  onSavingChange,
  onClose,
}: {
  postId: string
  saving: boolean
  onSavingChange: (saving: boolean) => void
  onClose: () => void
}) {
  const { accessToken } = useAuth()
  const { data: post, error: loadError, isValidating } = useSWR(
    accessToken ? ([postKey(postId), accessToken] as const) : null,
    fetchPost,
    { revalidateOnMount: true }
  )

  if (loadError) {
    return <p role="alert" className="text-sm text-destructive">Không tải được bài viết. Đóng rồi thử lại nhé.</p>
  }
  if (!post || isValidating) {
    return (
      <div className="flex justify-center py-8">
        <Spinner aria-hidden />
      </div>
    )
  }
  if (post.status === "PROCESSING") {
    return <p role="status" className="text-sm text-muted-foreground">Bài đang được xử lý hoặc kiểm duyệt. Hãy thử sửa lại sau ít phút.</p>
  }
  return <EditPostFields post={post} saving={saving} onSavingChange={onSavingChange} onClose={onClose} />
}

function EditPostFields({
  post,
  saving,
  onSavingChange,
  onClose,
}: {
  post: ApiPost
  saving: boolean
  onSavingChange: (saving: boolean) => void
  onClose: () => void
}) {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()
  const fileInput = useRef<HTMLInputElement>(null)
  const [body, setBody] = useState(post.body ?? "")
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const [newMediaIds, setNewMediaIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const existing = post.media.filter((media) => media.type === "VIDEO" && !removedIds.includes(media.id))
  const { uploads, error: uploadError, add, retry, remove, release } = useMediaUploads({
    onChange: (mediaIds) => setNewMediaIds(mediaIds),
    reserved: existing.length,
  })

  const keptIds = existing.map((media) => media.id)
  const finalIds = [...keptIds, ...newMediaIds]
  const trimmed = body.trim()
  const words = countWords(trimmed)
  const tooLong = trimmed.length > MAX_POST_LENGTH || words > MAX_POST_WORDS
  const empty = trimmed === "" && finalIds.length === 0
  const uploading = uploads.some((item) => item.mediaId === null)
  const brokenVideo = existing.some((media) => media.status === "FAILED")
  const unchanged = trimmed === (post.body ?? "").trim() && removedIds.length === 0 && uploads.length === 0
  const canSave = !saving && !tooLong && !empty && !uploading && !brokenVideo && !unchanged
  const total = existing.length + uploads.length

  async function save() {
    if (!accessToken) return
    onSavingChange(true)
    setError(null)
    try {
      const saved = await updatePost(accessToken, post.id, { body: trimmed, mediaIds: finalIds })
      release()
      onClose()
      toast.add(resultToast(saved))
      void mutate((key) => Array.isArray(key) && String(key[0]).startsWith(POSTS_KEY))
    } catch (err) {
      setError(failureMessage(err))
    } finally {
      onSavingChange(false)
    }
  }

  function pickFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""
    void add(files)
  }

  const hint = error ?? uploadError
  return (
    <>
      <Textarea
        aria-label="Nội dung bài viết"
        value={body}
        rows={5}
        disabled={saving}
        aria-invalid={tooLong}
        onChange={(event) => setBody(event.target.value)}
      />
      <p className={tooLong ? "text-sm text-destructive" : "text-xs text-muted-foreground"}>
        {tooLong ? `Tối đa ${MAX_POST_WORDS} từ và ${MAX_POST_LENGTH} ký tự.` : `${words}/${MAX_POST_WORDS} từ`}
      </p>

      {(existing.length > 0 || uploads.length > 0) && (
        <ul className="space-y-2" aria-label="Video của bài viết">
          {existing.map((media) => (
            <ExistingVideoRow
              key={media.id}
              media={media}
              disabled={saving}
              onRemove={() => setRemovedIds((ids) => [...ids, media.id])}
            />
          ))}
          {uploads.map((item) => (
            <li key={item.key} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm">
              <ClapperboardIcon aria-hidden className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate">{item.fileName}</span>
              <span className={item.status === "failed" ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                {item.status === "uploading" && `Đang tải ${Math.round(item.progress)}%`}
                {item.status === "failed" && (item.error ?? "Tải lên thất bại")}
                {item.status === "ready" && <CheckIcon aria-label="Đã tải lên" className="size-4 text-primary" />}
              </span>
              {item.status === "failed" && (
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Thử tải lại" disabled={saving} onClick={() => void retry(item.key)}>
                  <RotateCcwIcon aria-hidden />
                </Button>
              )}
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Bỏ ${item.fileName}`} disabled={saving} onClick={() => remove(item.key)}>
                <XIcon aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <input ref={fileInput} type="file" accept="video/*" multiple hidden onChange={pickFiles} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          shape="pill"
          disabled={saving || total >= MAX_POST_MEDIA}
          onClick={() => fileInput.current?.click()}
        >
          <PlusIcon aria-hidden data-icon="inline-start" />
          Thêm video
        </Button>
      </div>

      {brokenVideo && (
        <p role="alert" className="text-sm text-destructive">
          Có video xử lý không thành công. Hãy gỡ video đó, rồi thêm video khác nếu cần.
        </p>
      )}
      {hint && <p role="alert" className="text-sm text-destructive">{hint}</p>}

      <DialogFooter>
        <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>
          Huỷ
        </Button>
        <Button type="button" disabled={!canSave} onClick={() => void save()}>
          {saving ? "Đang lưu…" : "Lưu"}
        </Button>
      </DialogFooter>
    </>
  )
}

function ExistingVideoRow({
  media,
  disabled,
  onRemove,
}: {
  media: ApiMedia
  disabled: boolean
  onRemove: () => void
}) {
  const failed = media.status === "FAILED"
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm">
      <ClapperboardIcon aria-hidden className="size-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1 truncate">Video đã đăng</span>
      {failed && <span className="text-xs text-destructive">Xử lý lỗi</span>}
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Gỡ video" disabled={disabled} onClick={onRemove}>
        <XIcon aria-hidden />
      </Button>
    </li>
  )
}
