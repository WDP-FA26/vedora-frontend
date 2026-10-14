"use client"

import { useId, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { EllipsisIcon, MessageCircleIcon, PencilIcon, Trash2Icon } from "lucide-react"

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { toAuthor } from "@/features/auth/lib/to-author"
import { useComments } from "@/features/posts/hooks/use-comments"
import { COMMENTS_ANCHOR } from "@/features/posts/posts-cache"
import {
  MAX_COMMENT_LENGTH,
  commentFormSchema,
  type ApiComment,
  type CommentFormValues,
} from "@/features/posts/schemas"
import { profilePath } from "@/features/profiles/profiles-cache"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { ApiError } from "@/features/shared/lib/api-client"
import { formatCount, formatPostDate, formatPostDateLong } from "@/features/shared/lib/format"

/** Saves within this long of creation are the create itself, not an edit. */
const EDIT_GRACE_MS = 1000

function writeError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Tải lại trang rồi thử lại nhé."
    if (error.status === 403) return "Bạn không có quyền làm việc này."
    if (error.status === 404) return "Bài viết hoặc bình luận này không còn nữa."
  }
  return "Không lưu được. Thử lại nhé."
}

/**
 * The comments under a published post: a composer for signed-in visitors, then
 * the thread, newest first. Authors edit and delete their own comments; the
 * post's author and admins may delete any of them.
 */
export function PostComments({
  postId,
  postAuthorId,
  count,
}: {
  postId: string
  postAuthorId: string
  count: number
}) {
  const { user, isAuthenticated } = useAuth()
  const pathname = usePathname()
  const { comments, hasMore, loadMore, error, isLoading, isLoadingMore, add, edit, remove } =
    useComments(postId)

  return (
    <section
      id={COMMENTS_ANCHOR}
      aria-labelledby="post-comments-title"
      className="scroll-mt-14 border-t border-border"
    >
      <h2 id="post-comments-title" className="px-4 pt-4 font-sans text-base font-bold sm:px-5">
        Bình luận <span className="font-normal text-muted-foreground">{formatCount(count)}</span>
      </h2>

      {isAuthenticated ? (
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <CommentForm label="Viết bình luận" submitLabel="Bình luận" onSubmit={add} resetOnSubmit />
        </div>
      ) : (
        <p className="border-b border-border px-4 py-3 text-sm text-muted-foreground sm:px-5">
          <Link
            href={`/login?next=${encodeURIComponent(pathname)}`}
            className="font-medium text-primary hover:underline"
          >
            Đăng nhập
          </Link>{" "}
          để bình luận.
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center p-6">
          <Spinner aria-label="Đang tải bình luận" />
        </div>
      ) : error && comments.length === 0 ? (
        <p role="alert" className="p-4 text-sm text-destructive sm:px-5">
          Không tải được bình luận. Thử tải lại trang nhé.
        </p>
      ) : comments.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageCircleIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Chưa có bình luận</EmptyTitle>
            <EmptyDescription>Hãy là người đầu tiên chia sẻ suy nghĩ.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul aria-label="Danh sách bình luận">
          {comments.map((comment) => {
            const isAuthor = user?.id === comment.author.id
            return (
              <li key={comment.id} className="border-b border-border">
                <CommentItem
                  comment={comment}
                  canEdit={isAuthor}
                  canDelete={isAuthor || user?.id === postAuthorId || user?.role === "ADMIN"}
                  onEdit={(body) => edit(comment.id, body)}
                  onDelete={() => remove(comment.id)}
                />
              </li>
            )
          })}
        </ul>
      )}

      {hasMore && (
        <div className="flex justify-center p-3">
          <Button variant="outline" disabled={isLoadingMore} onClick={() => void loadMore()}>
            {isLoadingMore && <Spinner aria-hidden />}
            Xem thêm bình luận
          </Button>
        </div>
      )}
    </section>
  )
}

function CommentItem({
  comment,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  comment: ApiComment
  canEdit: boolean
  canDelete: boolean
  onEdit: (body: string) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const author = toAuthor(comment.author)
  const profileHref = profilePath(comment.author.id)
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const edited =
    new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime() > EDIT_GRACE_MS

  async function confirmDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await onDelete()
      setConfirming(false)
    } catch (error) {
      setDeleteError(writeError(error))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <article aria-label={`Bình luận của ${author.name}`} className="flex min-w-0 gap-3 px-4 py-3 sm:px-5">
      <Link href={profileHref} aria-label={`Hồ sơ của ${author.name}`} className="self-start rounded-full">
        <AuthorAvatar author={author} />
      </Link>

      <div className="min-w-0 flex-1">
        <header className="flex min-w-0 items-start gap-2 text-[0.9375rem] leading-5">
          <p className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1">
            <Link href={profileHref} className="truncate font-semibold hover:underline">
              {author.name}
            </Link>
            <span className="truncate text-muted-foreground">@{author.handle}</span>
            <span aria-hidden className="text-muted-foreground">
              ·
            </span>
            <time
              dateTime={comment.createdAt}
              title={formatPostDateLong(comment.createdAt)}
              className="text-muted-foreground"
            >
              {formatPostDate(comment.createdAt)}
            </time>
            {edited && <span className="text-xs text-muted-foreground">(đã sửa)</span>}
          </p>

          {(canEdit || canDelete) && !editing && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="action" size="icon-sm" shape="pill" className="-my-1 -mr-2" />}
                aria-label="Tùy chọn bình luận"
              >
                <EllipsisIcon aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {canEdit && (
                  <DropdownMenuItem onClick={() => setEditing(true)}>
                    <PencilIcon aria-hidden />
                    Sửa bình luận
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem variant="destructive" onClick={() => setConfirming(true)}>
                    <Trash2Icon aria-hidden />
                    Xoá bình luận
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>

        {editing ? (
          <div className="mt-2">
            <CommentForm
              label="Sửa bình luận"
              submitLabel="Lưu"
              defaultBody={comment.body}
              autoFocus
              onSubmit={async (body) => {
                await onEdit(body)
                setEditing(false)
              }}
              onCancel={() => setEditing(false)}
            />
          </div>
        ) : (
          <p className="mt-1 text-[0.9375rem] leading-[1.45] break-words whitespace-pre-line">
            {comment.body}
          </p>
        )}
      </div>

      <AlertDialog
        open={confirming}
        onOpenChange={(open) => {
          setConfirming(open)
          if (!open) setDeleteError(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá bình luận này?</AlertDialogTitle>
            <AlertDialogDescription>
              Bình luận sẽ bị xoá vĩnh viễn. Không hoàn tác được.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Giữ lại</AlertDialogCancel>
            {/* Stays open until the API answers, so a failure can be shown. */}
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting && <Spinner aria-hidden />}
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  )
}

/** Writes a new comment, or edits one in place when given `defaultBody`. */
function CommentForm({
  label,
  submitLabel,
  defaultBody = "",
  autoFocus,
  resetOnSubmit,
  onSubmit,
  onCancel,
}: {
  label: string
  submitLabel: string
  defaultBody?: string
  autoFocus?: boolean
  resetOnSubmit?: boolean
  onSubmit: (body: string) => Promise<void>
  onCancel?: () => void
}) {
  const fieldId = useId()
  const form = useForm<CommentFormValues>({
    resolver: zodResolver(commentFormSchema),
    defaultValues: { body: defaultBody },
  })
  const { isSubmitting, errors } = form.formState
  const length = useWatch({ control: form.control, name: "body" }).length

  async function submit({ body }: CommentFormValues) {
    try {
      await onSubmit(body)
      if (resetOnSubmit) form.reset({ body: "" })
    } catch (error) {
      form.setError("root", { message: writeError(error) })
    }
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-2">
      <Controller
        name="body"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={fieldId} className="sr-only">
              {label}
            </FieldLabel>
            <Textarea
              {...field}
              id={fieldId}
              rows={2}
              maxLength={MAX_COMMENT_LENGTH}
              autoFocus={autoFocus}
              aria-invalid={fieldState.invalid}
              placeholder="Chia sẻ suy nghĩ của bạn…"
              onKeyDown={(event) => {
                // Ctrl/⌘ + Enter sends, like most comment boxes.
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault()
                  void form.handleSubmit(submit)()
                }
              }}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <div className="flex items-center justify-end gap-2">
        {errors.root && (
          <p role="alert" className="mr-auto text-sm text-destructive">
            {errors.root.message}
          </p>
        )}
        <span className="text-xs text-muted-foreground tabular-nums">
          {length}/{MAX_COMMENT_LENGTH}
        </span>
        {onCancel && (
          <Button type="button" variant="ghost" disabled={isSubmitting} onClick={onCancel}>
            Huỷ
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting || length === 0}>
          {isSubmitting && <Spinner aria-hidden />}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
