"use client"

import { useEffect, useId, useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import useSWR from "swr"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  EllipsisIcon,
  FlagIcon,
  MessageCircleIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react"

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
import { ReportDialog } from "@/features/posts/components/report-dialog"
import { COMMENTS_ANCHOR, commentsKey } from "@/features/posts/posts-cache"
import { fetchComment } from "@/features/posts/lib/posts-api"
import { ModerationFindings } from "@/features/posts/components/moderation-findings"
import { rejectionMessage } from "@/features/posts/lib/moderation-labels"
import {
  MAX_COMMENT_LENGTH,
  commentFormSchema,
  contentRejectedDetailsSchema,
  type ModerationFinding,
  type ApiComment,
  type CommentFormValues,
} from "@/features/posts/schemas"
import { profilePath } from "@/features/profiles/profiles-cache"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { LogoMark } from "@/features/shared/components/wordmark"
import { VerifiedBadge } from "@/features/shared/components/verified-badge"
import { ApiError } from "@/features/shared/lib/api-client"
import { formatCount } from "@/features/shared/lib/format"
import { RelativeTime } from "@/features/shared/components/relative-time"

/** Saves within this long of creation are the create itself, not an edit. */
const EDIT_GRACE_MS = 1000

/** The words of a rejected comment that broke the policy, and why. */
function rejectedParts(error: unknown): ModerationFinding[] {
  if (!(error instanceof ApiError) || error.code !== "CONTENT_REJECTED") return []
  const details = contentRejectedDetailsSchema.safeParse(error.details ?? {})
  if (!details.success) return []
  return details.data.findings ?? []
}

function writeError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Tải lại trang rồi thử lại nhé."
    if (error.status === 403) return "Bạn không có quyền làm việc này."
    if (error.status === 404) return "Bài viết hoặc bình luận này không còn nữa."
    if (error.code === "CONTENT_REJECTED") {
      const details = contentRejectedDetailsSchema.safeParse(error.details ?? {})
      if (!details.success) return rejectionMessage(null, "Bình luận")
      return rejectionMessage(details.data.category, "Bình luận", details.data.reasonText)
    }
    if (error.status === 503) return "Chưa kiểm duyệt được bình luận lúc này. Thử lại sau giây lát."
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
  const { accessToken, isAuthenticated } = useAuth()
  const pathname = usePathname()
  const focusId = useSearchParams().get("comment")
  const { data: focused, mutate: refreshFocused } = useSWR(
    focusId
      ? ([`${commentsKey(postId)}/${encodeURIComponent(focusId)}`, accessToken] as const)
      : null,
    fetchComment,
    { shouldRetryOnError: false }
  )
  const { data: focusedRoot, mutate: refreshFocusedRoot } = useSWR(
    focused?.parentId
      ? ([`${commentsKey(postId)}/${focused.parentId}`, accessToken] as const)
      : null,
    fetchComment,
    { shouldRetryOnError: false }
  )
  const {
    comments,
    hasMore,
    loadMore,
    error,
    isLoading,
    isLoadingMore,
    add,
    edit,
    remove,
    changeReplyCount,
  } = useComments(postId)
  const focusRoot = focused?.parentId ? focusedRoot : focused
  const visible = [
    ...new Map(
      [...(focusRoot ? [focusRoot] : []), ...comments].map((item) => [item.id, item])
    ).values(),
  ]
  const [deletedRoots, setDeletedRoots] = useState<string[]>([])
  const visibleComments = visible.filter((item) => !deletedRoots.includes(item.id))

  useEffect(() => {
    if (focused)
      document.getElementById(`comment-${focused.id}`)?.scrollIntoView({ block: "center" })
  }, [focused])

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
      ) : error && visibleComments.length === 0 ? (
        <p role="alert" className="p-4 text-sm text-destructive sm:px-5">
          Không tải được bình luận. Thử tải lại trang nhé.
        </p>
      ) : visibleComments.length === 0 ? (
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
          {visibleComments.map((comment) => (
            <li key={comment.id} className="border-b border-border">
              <CommentThread
                comment={comment}
                postAuthorId={postAuthorId}
                focused={focused?.parentId === comment.id ? focused : undefined}
                focusId={focusId}
                onCountChange={async (delta) => {
                  await changeReplyCount(comment.id, delta)
                  if (focusRoot?.id === comment.id) {
                    void refreshFocusedRoot()
                    void refreshFocused()
                  }
                }}
                onEdit={async (body) => {
                  await edit(comment.id, body)
                  if (focusRoot?.id === comment.id) {
                    void refreshFocusedRoot()
                    void refreshFocused()
                  }
                }}
                onDelete={async () => {
                  await remove(comment.id)
                  setDeletedRoots((ids) => [...ids, comment.id])
                }}
              />
            </li>
          ))}
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

function CommentThread({
  comment,
  postAuthorId,
  focused,
  focusId,
  onCountChange,
  onEdit,
  onDelete,
}: {
  comment: ApiComment
  postAuthorId: string
  focused?: ApiComment
  focusId: string | null
  onCountChange: (delta: number) => Promise<unknown>
  onEdit: (body: string) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const { user, isAuthenticated } = useAuth()
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)
  const [focusHidden, setFocusHidden] = useState(false)
  const [target, setTarget] = useState<ApiComment | null>(null)
  const [removed, setRemoved] = useState<string[]>([])
  const showReplies = expanded || (Boolean(focused) && !focusHidden)
  const replies = useComments(comment.postId, comment.id, showReplies)
  const items = [
    ...new Map(
      [...(focused ? [focused] : []), ...replies.comments].map((item) => [item.id, item])
    ).values(),
  ].filter((item) => !removed.includes(item.id))
  const permissions = (item: ApiComment) => ({
    canEdit: user?.id === item.author.id,
    canDelete: user?.id === item.author.id || user?.id === postAuthorId || user?.role === "ADMIN",
  })
  const replyButton = (item: ApiComment) =>
    isAuthenticated ? (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setExpanded(true)
          setTarget(item)
        }}
      >
        Trả lời
      </Button>
    ) : (
      <Link
        href={`/login?next=${encodeURIComponent(pathname)}`}
        className="text-sm text-primary hover:underline"
      >
        Đăng nhập để trả lời
      </Link>
    )

  useEffect(() => {
    if (focused && showReplies)
      document.getElementById(`comment-${focused.id}`)?.scrollIntoView({ block: "center" })
  }, [focused, showReplies])

  return (
    <>
      <CommentItem
        comment={comment}
        {...permissions(comment)}
        onEdit={onEdit}
        onDelete={onDelete}
        highlighted={focusId === comment.id}
      >
        {replyButton(comment)}
        {comment.replyCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={showReplies}
            onClick={() => {
              setFocusHidden(true)
              setExpanded(!showReplies)
            }}
          >
            {showReplies ? "Ẩn phản hồi" : `Xem ${comment.replyCount} phản hồi`}
          </Button>
        )}
      </CommentItem>
      {showReplies && (
        <div className="ml-5 border-l border-border sm:ml-12">
          {replies.isLoading && (
            <div className="p-3">
              <Spinner aria-label="Đang tải phản hồi" />
            </div>
          )}
          {replies.error && (
            <p role="alert" className="p-3 text-sm text-destructive">
              Không tải được phản hồi.{" "}
              <button className="underline" onClick={() => void replies.refresh()}>
                Thử lại
              </button>
            </p>
          )}
          <ul aria-label={`Phản hồi cho bình luận của ${comment.author.fullName}`}>
            {items.map((item) => (
              <li key={item.id}>
                <CommentItem
                  comment={item}
                  {...permissions(item)}
                  highlighted={focusId === item.id}
                  onEdit={async (body) => {
                    await replies.edit(item.id, body)
                    await onCountChange(0)
                  }}
                  onDelete={async () => {
                    await replies.remove(item.id)
                    setRemoved((ids) => [...ids, item.id])
                    if (target?.id === item.id) setTarget(null)
                    await onCountChange(-1)
                    void replies.refresh()
                  }}
                >
                  {replyButton(item)}
                </CommentItem>
              </li>
            ))}
          </ul>
          {replies.hasMore && (
            <Button
              className="m-3"
              variant="outline"
              disabled={replies.isLoadingMore}
              onClick={() => void replies.loadMore()}
            >
              Xem thêm phản hồi
            </Button>
          )}
          {target && (
            <div className="px-4 py-3">
              <p className="mb-2 text-sm text-muted-foreground">
                Đang trả lời {target.author.fullName}
              </p>
              <CommentForm
                key={target.id}
                label="Viết trả lời"
                submitLabel="Trả lời"
                autoFocus
                onCancel={() => setTarget(null)}
                onSubmit={async (body) => {
                  await replies.add(body, target.id)
                  setTarget(null)
                  await onCountChange(1)
                }}
              />
            </div>
          )}
        </div>
      )}
    </>
  )
}

function CommentItem({
  comment,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  children,
  highlighted,
}: {
  comment: ApiComment
  canEdit: boolean
  canDelete: boolean
  onEdit: (body: string) => Promise<void>
  onDelete: () => Promise<void>
  children?: React.ReactNode
  highlighted?: boolean
}) {
  const author = toAuthor(comment.author)
  const { user, isAuthenticated } = useAuth()
  const canReport = isAuthenticated && user?.id !== comment.author.id
  const isSystem = comment.author.isSystem
  const profileHref = profilePath(comment.author.id)
  const [editing, setEditing] = useState(false)
  const [reporting, setReporting] = useState(false)
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
    <article
      id={`comment-${comment.id}`}
      aria-label={`Bình luận của ${author.name}`}
      className={`flex min-w-0 scroll-mt-20 gap-3 px-4 py-3 sm:px-5 ${highlighted ? "bg-primary/5" : ""}`}
    >
      {isSystem ? (
        <SystemAvatar />
      ) : (
        <Link
          href={profileHref}
          aria-label={`Hồ sơ của ${author.name}`}
          className="self-start rounded-full"
        >
          <AuthorAvatar author={author} />
        </Link>
      )}

      <div className="min-w-0 flex-1">
        <header className="flex min-w-0 items-start gap-2 text-[0.9375rem] leading-5">
          <p className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1">
            {isSystem ? (
              <>
                <span className="truncate font-semibold">{author.name}</span>
                <span className="self-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.6875rem] leading-none font-medium text-primary">
                  Tóm tắt tự động
                </span>
              </>
            ) : (
              <>
                <Link href={profileHref} className="truncate font-semibold hover:underline">
                  {author.name}
                </Link>
                {author.verified && (
                  <span className="self-center">
                    <VerifiedBadge label={author.verified} />
                  </span>
                )}
                <span className="truncate text-muted-foreground">@{author.handle}</span>
              </>
            )}
            <span aria-hidden className="text-muted-foreground">
              ·
            </span>
            <RelativeTime iso={comment.createdAt} className="text-muted-foreground" />
            {edited && <span className="text-xs text-muted-foreground">(đã sửa)</span>}
          </p>

          {(canEdit || canDelete || canReport) && !editing && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="action" size="icon-sm" shape="pill" className="-my-1 -mr-2" />}
                aria-label="Tùy chọn bình luận"
              >
                <EllipsisIcon aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {canReport && (
                  <DropdownMenuItem onClick={() => setReporting(true)}>
                    <FlagIcon aria-hidden />
                    Báo cáo bình luận
                  </DropdownMenuItem>
                )}
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

        {comment.replyToAuthor && (
          <p className="mt-1 text-xs text-muted-foreground">
            Trả lời{" "}
            {comment.replyToAuthor.isSystem ? (
              <span className="text-primary">{comment.replyToAuthor.fullName}</span>
            ) : (
              <Link
                href={profilePath(comment.replyToAuthor.id)}
                className="text-primary hover:underline"
              >
                {comment.replyToAuthor.fullName}
              </Link>
            )}
          </p>
        )}
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
        {!editing && <div className="mt-1 flex flex-wrap items-center gap-1">{children}</div>}
      </div>

      {reporting && (
        <ReportDialog
          postId={comment.postId}
          commentId={comment.id}
          authorName={author.name}
          open={reporting}
          onOpenChange={setReporting}
        />
      )}
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
              {comment.parentId
                ? "Bình luận sẽ bị xoá vĩnh viễn. Không hoàn tác được."
                : "Bình luận và tất cả phản hồi sẽ bị xoá vĩnh viễn. Không hoàn tác được."}
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
  const [findings, setFindings] = useState<ModerationFinding[]>([])

  async function submit({ body }: CommentFormValues) {
    setFindings([])
    try {
      await onSubmit(body)
      if (resetOnSubmit) form.reset({ body: "" })
    } catch (error) {
      setFindings(rejectedParts(error))
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

      {findings.length > 0 && (
        <div className="rounded-xl bg-destructive/10 p-2">
          <ModerationFindings findings={findings} />
        </div>
      )}

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

/** Vedora AI uses the shared AI mark, matching the Meal Planner assistant. */
function SystemAvatar() {
  return <LogoMark className="size-8 self-start" />
}
