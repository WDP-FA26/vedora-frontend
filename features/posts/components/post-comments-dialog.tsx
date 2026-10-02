"use client"

import { useRef, useState, type FormEvent } from "react"
import { PencilIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { toAuthor } from "@/features/auth/lib/to-author"
import { useComments } from "@/features/posts/hooks/use-comments"
import {
  usePostInteractions,
  usePostRequest,
} from "@/features/posts/hooks/use-post-interactions"
import {
  createComment,
  deleteComment,
  interactionError,
  updateComment,
} from "@/features/posts/lib/posts-api"
import { MAX_COMMENT_LENGTH, type ApiComment } from "@/features/posts/schemas"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { formatPostDate } from "@/features/shared/lib/format"

export function PostCommentsDialog({
  postId,
  postAuthorId,
  open,
  onOpenChange,
}: {
  postId: string
  postAuthorId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-[36rem]">
        <div className="pr-8">
          <DialogHeader>
            <DialogTitle>Bình luận</DialogTitle>
            <DialogDescription>
              Chia sẻ ý kiến của bạn về bài đăng.
            </DialogDescription>
          </DialogHeader>
        </div>
        {open && <CommentThread postId={postId} postAuthorId={postAuthorId} />}
      </DialogContent>
    </Dialog>
  )
}

function CommentThread({
  postId,
  postAuthorId,
}: {
  postId: string
  postAuthorId: string
}) {
  const { user, accessToken } = useAuth()
  const request = usePostRequest()
  const { refreshPost } = usePostInteractions(postId)
  const {
    comments,
    error: loadError,
    isLoading,
    isValidating,
    hasMore,
    loadMore,
    reload,
  } = useComments(postId)
  const [body, setBody] = useState("")
  const [editing, setEditing] = useState<ApiComment | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const canSubmit = Boolean(
    accessToken && body.trim() && body.length <= MAX_COMMENT_LENGTH && !pending,
  )

  async function syncAfterWrite() {
    const results = await Promise.allSettled([reload(), refreshPost()])
    if (results.some((result) => result.status === "rejected")) {
      setError(
        "Đã lưu thay đổi, nhưng chưa tải lại được dữ liệu. Nhấn tải lại để cập nhật.",
      )
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit || busy.current) return
    busy.current = true
    setPending(true)
    setError(null)
    try {
      await request((token) =>
        editing
          ? updateComment(token, postId, editing.id, body.trim())
          : createComment(token, postId, body.trim()),
      )
      setBody("")
      setEditing(null)
      await syncAfterWrite()
    } catch (error) {
      setError(interactionError(error))
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  async function remove(commentId: string) {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setError(null)
    try {
      await request((token) => deleteComment(token, postId, commentId))
      setDeleteTarget(null)
      if (editing?.id === commentId) {
        setEditing(null)
        setBody("")
      }
      await syncAfterWrite()
    } catch (error) {
      setError(interactionError(error))
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  async function retry() {
    setError(null)
    try {
      await Promise.all([reload(), refreshPost()])
    } catch (error) {
      setError(interactionError(error))
    }
  }

  function edit(comment: ApiComment) {
    setEditing(comment)
    setBody(comment.body)
    setError(null)
    textarea.current?.focus()
  }

  return (
    <>
      <div
        className="min-h-0 flex-1 space-y-4 overflow-y-auto"
        aria-busy={isLoading}
      >
        {isLoading && (
          <p role="status" className="py-6 text-center text-muted-foreground">
            Đang tải bình luận…
          </p>
        )}
        {!isLoading && !loadError && comments.length === 0 && (
          <p className="py-6 text-center text-muted-foreground">
            Chưa có bình luận. Hãy chia sẻ ý kiến đầu tiên.
          </p>
        )}
        {comments.map((comment) => {
          const isAuthor = comment.author.id === user?.id
          const canDelete =
            isAuthor || postAuthorId === user?.id || user?.role === "ADMIN"
          return (
            <article
              key={comment.id}
              aria-label={`Bình luận của ${comment.author.fullName}`}
              className="flex gap-3"
            >
              <AuthorAvatar author={toAuthor(comment.author)} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 text-xs">
                  <span className="font-semibold">
                    {comment.author.fullName}
                  </span>
                  <time
                    dateTime={comment.createdAt}
                    className="text-muted-foreground"
                  >
                    {formatPostDate(comment.createdAt)}
                  </time>
                  {comment.updatedAt !== comment.createdAt && (
                    <span className="text-muted-foreground">Đã chỉnh sửa</span>
                  )}
                </div>
                <p className="mt-1 break-words whitespace-pre-wrap">
                  {comment.body}
                </p>
                <div className="mt-1 flex gap-1">
                  {isAuthor && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => edit(comment)}
                      aria-label={`Sửa bình luận của ${comment.author.fullName}`}
                    >
                      <PencilIcon aria-hidden />
                      Sửa
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => setDeleteTarget(comment.id)}
                      aria-label={`Xóa bình luận của ${comment.author.fullName}`}
                    >
                      <Trash2Icon aria-hidden />
                      Xóa
                    </Button>
                  )}
                </div>
                {deleteTarget === comment.id && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span>Xóa bình luận này?</span>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={pending}
                      onClick={() => void remove(comment.id)}
                    >
                      Xác nhận xóa
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => setDeleteTarget(null)}
                    >
                      Hủy
                    </Button>
                  </div>
                )}
              </div>
            </article>
          )
        })}
        {hasMore && !loadError && (
          <Button
            variant="outline"
            className="w-full"
            disabled={isValidating || pending}
            onClick={() => void loadMore()}
          >
            {isValidating ? "Đang tải…" : "Tải thêm bình luận"}
          </Button>
        )}
      </div>
      {(loadError || error) && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 text-destructive"
        >
          <p>{error ?? interactionError(loadError)}</p>
          <Button
            variant="outline"
            size="sm"
            disabled={pending || isValidating}
            onClick={() => void retry()}
          >
            Tải lại
          </Button>
        </div>
      )}
      <form onSubmit={submit} className="space-y-2 border-t border-border pt-3">
        <label
          htmlFor={`comment-body-${postId}`}
          className="text-sm font-medium"
        >
          {editing ? "Chỉnh sửa bình luận" : "Viết bình luận"}
        </label>
        <Textarea
          id={`comment-body-${postId}`}
          ref={textarea}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={MAX_COMMENT_LENGTH}
          disabled={pending || !accessToken}
          placeholder="Chia sẻ ý kiến của bạn…"
          rows={3}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {body.length}/{MAX_COMMENT_LENGTH}
          </span>
          <div className="flex gap-2">
            {editing && (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setEditing(null)
                  setBody("")
                }}
              >
                Hủy sửa
              </Button>
            )}
            <Button type="submit" disabled={!canSubmit}>
              {pending
                ? "Đang lưu…"
                : editing
                  ? "Lưu thay đổi"
                  : "Gửi bình luận"}
            </Button>
          </div>
        </div>
      </form>
    </>
  )
}
