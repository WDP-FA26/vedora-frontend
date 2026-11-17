"use client"

import { useState } from "react"
import { useSWRConfig } from "swr"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { rejectionMessage } from "@/features/posts/lib/moderation-labels"
import { updatePost } from "@/features/posts/lib/posts-api"
import { POSTS_KEY } from "@/features/posts/posts-cache"
import {
  MAX_POST_LENGTH,
  MAX_POST_WORDS,
  countWords,
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
  return {
    title: "Đã lưu chỉnh sửa",
    description: "Bài đang được kiểm duyệt lại. Chỉ bạn thấy bài cho đến khi xong.",
  }
}

function failureMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "POST_NOT_EDITABLE") return "Bài đang được xử lý, hãy thử lại sau giây lát."
    if (error.code === "EMPTY_POST") return "Bài viết cần có chữ hoặc video."
    if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Hãy thử lại."
  }
  return "Không lưu được chỉnh sửa. Thử lại nhé."
}

/**
 * Edits the text of the author's own post. Changed text is checked again like
 * a new post, so the dialog says so before saving. Videos stay as they are.
 */
export function EditPostDialog({
  postId,
  initialBody,
  hasVideo,
  open,
  onOpenChange,
}: {
  postId: string
  initialBody: string
  /** A post with a video may have its text removed; one without may not. */
  hasVideo: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()
  const [body, setBody] = useState(initialBody)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = body.trim()
  const words = countWords(trimmed)
  const tooLong = trimmed.length > MAX_POST_LENGTH || words > MAX_POST_WORDS
  const empty = trimmed === "" && !hasVideo
  const unchanged = trimmed === initialBody.trim()

  function handleOpenChange(next: boolean) {
    if (saving) return
    if (next) {
      setBody(initialBody)
      setError(null)
    }
    onOpenChange(next)
  }

  async function save() {
    if (!accessToken) return
    setSaving(true)
    setError(null)
    try {
      const post = await updatePost(accessToken, postId, trimmed)
      onOpenChange(false)
      toast.add(resultToast(post))
      void mutate((key) => Array.isArray(key) && String(key[0]).startsWith(POSTS_KEY))
    } catch (err) {
      setError(failureMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa bài viết</DialogTitle>
          <DialogDescription>
            Nội dung đã sửa sẽ được kiểm duyệt lại như bài mới.
            {hasVideo && " Video đính kèm giữ nguyên."}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          aria-label="Nội dung bài viết"
          value={body}
          rows={5}
          disabled={saving}
          aria-invalid={tooLong}
          onChange={(event) => setBody(event.target.value)}
        />
        <p
          role={error ? "alert" : undefined}
          className={error || tooLong ? "text-sm text-destructive" : "text-xs text-muted-foreground"}
        >
          {error ?? (tooLong ? `Tối đa ${MAX_POST_WORDS} từ và ${MAX_POST_LENGTH} ký tự.` : `${words}/${MAX_POST_WORDS} từ`)}
        </p>
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={saving} onClick={() => handleOpenChange(false)}>
            Huỷ
          </Button>
          <Button type="button" disabled={saving || tooLong || empty || unchanged} onClick={() => void save()}>
            {saving ? "Đang lưu…" : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
