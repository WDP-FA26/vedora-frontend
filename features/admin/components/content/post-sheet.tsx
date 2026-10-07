"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import MuxPlayer from "@mux/mux-player-react/lazy"
import type { MuxPlayerRefAttributes } from "@mux/mux-player-react"
import { BookOpenIcon, ExternalLinkIcon, Trash2Icon } from "lucide-react"

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
import { PostStatusBadge } from "@/features/admin/components/content/post-columns"
import { Transcript } from "@/features/admin/components/content/transcript"
import { useAdminPost, useDeleteAdminPost } from "@/features/admin/hooks/use-admin-posts"
import type { AdminMediaDetail, AdminPostDetail } from "@/features/admin/schemas"
import { toAuthor } from "@/features/auth/lib/to-author"
import { postPath } from "@/features/posts/posts-cache"
import { profilePath } from "@/features/profiles/profiles-cache"
import { NEW_RECIPE_PATH } from "@/features/recipes/recipes-cache"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { ApiError } from "@/features/shared/lib/api-client"
import { formatCount, formatPostDateLong } from "@/features/shared/lib/format"

const FAILURE_MESSAGES: Record<NonNullable<AdminMediaDetail["failureReason"]>, string> = {
  TOO_LONG: "Video dài quá giới hạn.",
  ENCODING_FAILED: "Mux không xử lý được tệp video.",
  UPLOAD_ERRORED: "Tải lên bị lỗi.",
  UPLOAD_CANCELLED: "Tải lên đã bị huỷ.",
  UPLOAD_TIMED_OUT: "Tải lên quá thời gian.",
  NO_PLAYBACK_ID: "Video không có mã phát.",
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
          <PostBody key={post.id} post={post} onDeleted={onClose} />
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

function PostBody({ post, onDeleted }: { post: AdminPostDetail; onDeleted: () => void }) {
  const deletePost = useDeleteAdminPost()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)
  const { author, media } = post

  async function remove() {
    setConfirming(false)
    setDeleteFailed(false)
    setDeleting(true)
    try {
      await deletePost(post.id)
      onDeleted()
    } catch {
      setDeleteFailed(true)
      setDeleting(false)
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

        {post.body ? (
          <p className="text-base leading-7 break-words whitespace-pre-line">{post.body}</p>
        ) : (
          media.length === 0 && <p className="text-muted-foreground">Bài đăng trống.</p>
        )}

        <dl className="flex flex-wrap gap-x-6 gap-y-1 border-y py-3">
          {[
            { label: "lượt xem", value: post.viewCount },
            { label: "lượt thả mầm", value: post.likeCount },
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
        {deleteFailed && (
          <p role="alert" className="text-sm text-destructive">
            Không xoá được bài đăng. Thử lại nhé.
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
          <Button variant="destructive" disabled={deleting} onClick={() => setConfirming(true)}>
            {deleting ? <Spinner aria-hidden /> : <Trash2Icon aria-hidden />}
            Xoá bài đăng
          </Button>
        </div>
      </SheetFooter>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá bài đăng này?</AlertDialogTitle>
            <AlertDialogDescription>
              Bài đăng của {author.fullName} cùng video, bình luận và lượt thả mầm sẽ bị
              xoá vĩnh viễn. Không hoàn tác được.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Giữ lại</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void remove()}>
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
  const player = useRef<MuxPlayerRefAttributes>(null)
  const [time, setTime] = useState(0)

  return (
    <section aria-label={label} className="flex flex-col gap-3">
      <h3 className="text-[0.8125rem] text-muted-foreground">{label}</h3>

      {media.status === "READY" && media.playbackId ? (
        <>
          <div className="overflow-hidden rounded-xl bg-black">
            <MuxPlayer
              ref={player}
              playbackId={media.playbackId}
              streamType="on-demand"
              accentColor="var(--primary)"
              title={label}
              metadata={{ video_title: label }}
              className="block max-h-96 w-full"
              style={{ aspectRatio: media.aspectRatio?.replace(":", " / ") ?? "16 / 9" }}
              onTimeUpdate={() => setTime(player.current?.currentTime ?? 0)}
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
