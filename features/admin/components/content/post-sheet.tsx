"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { BookOpenIcon, ExternalLinkIcon, RotateCcwIcon, Trash2Icon } from "lucide-react"

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
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { PostStatusBadge } from "@/features/admin/components/content/post-columns"
import { ModerationPanel } from "@/features/admin/components/content/moderation-panel"
import { HighlightedText } from "@/features/admin/components/content/highlighted-text"
import { Transcript } from "@/features/admin/components/content/transcript"
import {
  useAdminPost,
  useDeleteAdminPost,
  useRestoreAdminPost,
} from "@/features/admin/hooks/use-admin-posts"
import type { AdminMediaDetail, AdminPostDetail } from "@/features/admin/schemas"
import { toAuthor } from "@/features/auth/lib/to-author"
import { VideoPlayer } from "@/features/posts/components/video-player"
import { postPath } from "@/features/posts/posts-cache"
import { profilePath } from "@/features/profiles/profiles-cache"
import { NEW_RECIPE_PATH } from "@/features/recipes/recipes-cache"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { ApiError } from "@/features/shared/lib/api-client"
import { formatCount, formatPostDateLong } from "@/features/shared/lib/format"

const FAILURE_MESSAGES: Record<NonNullable<AdminMediaDetail["failureReason"]>, string> = {
  TOO_LONG: "Video dài quá giới hạn.",
  ENCODING_FAILED: "Cloudinary không xử lý được tệp video.",
  UPLOAD_ERRORED: "Tải lên bị lỗi.",
  UPLOAD_TIMED_OUT: "Tải lên quá thời gian.",
}

/** A post in full: its text, videos and their transcripts, with delete. */
export function PostSheet({
  postId,
  onClose,
}: {
  postId: string | null
  onClose: () => void
}) {
  const { post, error } = useAdminPost(postId)

  return (
    <Sheet open={postId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        {post ? (
          <PostBody key={post.id} post={post} />
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>Bài đăng</SheetTitle>
              <SheetDescription>
                {!error
                  ? "Đang tải…"
                  : error instanceof ApiError && error.status === 404
                    ? "Bài đăng này đã bị xoá."
                    : "Không tải được bài đăng. Thử mở lại nhé."}
              </SheetDescription>
            </SheetHeader>
            {!error && (
              <div className="space-y-3 px-6" aria-hidden>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="aspect-video w-full" />
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function PostBody({ post }: { post: AdminPostDetail }) {
  const deletePost = useDeleteAdminPost()
  const restorePost = useRestoreAdminPost()
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [confirmingRestore, setConfirmingRestore] = useState(false)
  const [removeReason, setRemoveReason] = useState("")
  const [restoreNote, setRestoreNote] = useState("")
  const [working, setWorking] = useState<"remove" | "restore" | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const { author, media } = post

  async function remove() {
    setConfirmingRemove(false)
    setActionError(null)
    setWorking("remove")
    try {
      await deletePost(post.id, removeReason)
      setRemoveReason("")
    } catch {
      setActionError("Không gỡ được bài đăng. Thử lại nhé.")
    } finally {
      setWorking(null)
    }
  }

  async function restore() {
    setConfirmingRestore(false)
    setActionError(null)
    setWorking("restore")
    try {
      await restorePost(post.id, restoreNote)
      setRestoreNote("")
    } catch {
      setActionError("Không khôi phục được bài đăng. Thử lại nhé.")
    } finally {
      setWorking(null)
    }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Bài đăng</SheetTitle>
        <SheetDescription>
          Tạo {formatPostDateLong(post.createdAt)}
          {!post.publishedAt && " · chưa đăng công khai"}
        </SheetDescription>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pb-6">
        <div className="flex items-center gap-3">
          <AuthorAvatar author={toAuthor(author)} />
          <div className="min-w-0 flex-1">
            <Link
              href={profilePath(author.id)}
              className="block truncate font-medium underline-offset-4 hover:underline"
            >
              {author.fullName}
            </Link>
            <p className="truncate text-muted-foreground">@{author.username}</p>
          </div>
          <PostStatusBadge status={post.status} />
        </div>

        {post.blog && (
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold">{post.blog.title}</h3>
            {post.blog.coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- an arbitrary https cover the admin must see as posted
              <img src={post.blog.coverImageUrl} alt="" className="max-h-64 w-full rounded-xl object-cover" />
            )}
            <p className="leading-7 break-words whitespace-pre-line">{post.blog.excerpt}</p>
          </div>
        )}

        {post.removal && <PostRemovalNotice post={post} />}

        <ModerationPanel post={post} />

        {post.body ? (
          <HighlightedText
            text={post.body}
            items={post.moderation?.evidence?.items ?? []}
            className="text-base leading-7 break-words whitespace-pre-line"
          />
        ) : (
          media.length === 0 && <p className="text-muted-foreground">Bài đăng trống.</p>
        )}

        <dl className="flex flex-wrap gap-x-6 gap-y-1 border-y py-3">
          {[
            { label: "lượt xem", value: post.viewCount },
            { label: "lượt thích", value: post.likeCount },
            { label: "đăng lại", value: post.repostCount },
            { label: "bình luận", value: post.commentCount },
          ].map(({ label, value }) => (
            <div key={label} className="flex gap-1.5">
              <dd className="font-semibold tabular-nums">{formatCount(value)}</dd>
              <dt className="text-muted-foreground">{label}</dt>
            </div>
          ))}
        </dl>

        {media.map((item, index) => (
          <PostVideo
            key={item.id}
            media={item}
            label={media.length === 1 ? "Video" : `Video ${index + 1}/${media.length}`}
          />
        ))}
      </div>

      <SheetFooter>
        {actionError && (
          <p role="alert" className="text-sm text-destructive">
            {actionError}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Link
            href={`${NEW_RECIPE_PATH}?postId=${post.id}`}
            className={buttonVariants({ variant: "outline" })}
          >
            <BookOpenIcon aria-hidden />
            Viết công thức
          </Link>
          {post.status === "PUBLISHED" && (
            <Link
              href={postPath(post.id)}
              target="_blank"
              className={buttonVariants({ variant: "outline" })}
            >
              <ExternalLinkIcon aria-hidden />
              Mở trang bài viết
            </Link>
          )}
          {post.status === "REMOVED" ? (
            <Button
              variant="default"
              disabled={working !== null}
              onClick={() => setConfirmingRestore(true)}
            >
              {working === "restore" ? <Spinner aria-hidden /> : <RotateCcwIcon aria-hidden />}
              Khôi phục bài đăng
            </Button>
          ) : (
            <Button
              variant="destructive"
              disabled={working !== null}
              onClick={() => setConfirmingRemove(true)}
            >
              {working === "remove" ? <Spinner aria-hidden /> : <Trash2Icon aria-hidden />}
              Gỡ bài đăng
            </Button>
          )}
        </div>
      </SheetFooter>

      <AlertDialog open={confirmingRemove} onOpenChange={setConfirmingRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gỡ bài đăng này?</AlertDialogTitle>
            <AlertDialogDescription>
              Bài đăng của {author.fullName} sẽ chuyển sang trạng thái Đã gỡ (soft-delete), ẩn khỏi
              nền tảng nhưng vẫn giữ dữ liệu để bạn có thể khôi phục và tác giả có thể kháng cáo
              trong 14 ngày.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={removeReason}
            maxLength={500}
            rows={3}
            onChange={(event) => setRemoveReason(event.target.value)}
            placeholder="Lý do gỡ bài (không bắt buộc — gửi tới tác giả)"
            aria-label="Lý do gỡ bài"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Giữ lại</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void remove()}>
              Gỡ bài
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmingRestore} onOpenChange={setConfirmingRestore}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Khôi phục bài đăng này?</AlertDialogTitle>
            <AlertDialogDescription>
              Bài đăng của {author.fullName} sẽ được trả về trạng thái trước khi gỡ. Nếu đang có
              phiếu kháng cáo mở, phiếu đó sẽ tự động được chấp nhận.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={restoreNote}
            maxLength={500}
            rows={3}
            onChange={(event) => setRestoreNote(event.target.value)}
            placeholder="Ghi chú gửi tới tác giả (không bắt buộc)"
            aria-label="Ghi chú khôi phục"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={() => void restore()}>Khôi phục</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function PostRemovalNotice({ post }: { post: AdminPostDetail }) {
  const { removal } = post
  if (!removal) return null
  const actor = removal.removedByRole === "ADMIN" ? "Quản trị viên gỡ" : "Tác giả tự xoá"
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
      <p className="font-medium text-destructive">
        {actor} {formatPostDateLong(removal.removedAt)}
      </p>
      {removal.reason && (
        <p className="text-foreground">Lý do: {removal.reason}</p>
      )}
      {removal.restoredAt && (
        <p className="text-xs text-muted-foreground">
          Đã khôi phục {formatPostDateLong(removal.restoredAt)}.
        </p>
      )}
    </div>
  )
}

/** One video with its transcript; clicking a cue seeks the player. */
export function PostVideo({
  media,
  label,
}: {
  media: AdminMediaDetail
  label: string
}) {
  const player = useRef<HTMLVideoElement | null>(null)
  const [time, setTime] = useState(0)

  return (
    <section aria-label={label} className="flex flex-col gap-3">
      <h3 className="text-[0.8125rem] text-muted-foreground">{label}</h3>

      {media.status === "READY" ? (
        <>
          <div className="overflow-hidden rounded-xl bg-black">
            <VideoPlayer
              publicId={media.publicId}
              aspectRatio={media.aspectRatio}
              captions={media.captions}
              label={label}
              maxHeight="24rem"
              videoRef={player}
              onTimeUpdate={setTime}
            />
          </div>
          <Transcript
            captionStatus={media.captionStatus}
            tracks={media.captions}
            time={time}
            onSeek={(seconds) => {
              if (!player.current) return
              player.current.currentTime = seconds
              void player.current.play()
            }}
          />
        </>
      ) : (
        <p className="rounded-xl bg-muted px-4 py-3">
          {media.status === "FAILED"
            ? `Video lỗi. ${media.failureReason ? FAILURE_MESSAGES[media.failureReason] : ""}`
            : "Video đang được xử lý, chưa xem được."}
        </p>
      )}
    </section>
  )
}
