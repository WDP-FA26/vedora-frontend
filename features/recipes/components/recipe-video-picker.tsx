"use client"

import { useState } from "react"
import { SearchIcon, VideoIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { useAdminPosts } from "@/features/admin/hooks/use-admin-posts"
import type { AdminPost, CaptionStatus } from "@/features/admin/schemas"

const MAX_SHOWN = 40

export type PickedVideo = { postId: string; mediaId: string }

type VideoRow = {
  post: AdminPost
  media: AdminPost["media"][number]
  position: number
  videoCount: number
}

const CAPTION_LABELS: Record<CaptionStatus, string> = {
  READY: "Có phụ đề",
  TRANSCRIBING: "Đang tạo phụ đề",
  NONE: "Chưa có phụ đề",
  NO_SPEECH: "Không có lời nói",
  FAILED: "Lỗi phụ đề",
}

function videoRows(posts: readonly AdminPost[]): VideoRow[] {
  const rows: VideoRow[] = []
  for (const post of posts) {
    if (post.status === "REMOVED") continue
    const videos = post.media.filter((item) => item.type === "VIDEO" && item.status === "READY")
    videos.forEach((media, index) => {
      rows.push({ post, media, position: index + 1, videoCount: videos.length })
    })
  }
  return rows
}

function fold(text: string) {
  return text.normalize("NFC").toLowerCase()
}

function matches(row: VideoRow, query: string) {
  if (!query) return true
  const haystack = [row.post.author.fullName, row.post.author.username, row.post.body ?? ""]
  return haystack.some((text) => fold(text).includes(query))
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return null
  const whole = Math.round(seconds)
  const minutes = Math.floor(whole / 60)
  return `${minutes}:${String(whole % 60).padStart(2, "0")}`
}

export function RecipeVideoPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  onPick: (video: PickedVideo) => void
}) {
  const [query, setQuery] = useState("")
  const { posts, error, isLoading } = useAdminPosts()
  const folded = fold(query.trim())
  const found = videoRows(posts).filter((row) => matches(row, folded))
  const shown = found.slice(0, MAX_SHOWN)

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-2xl" mobileFullscreen>
        <DialogHeader>
          <DialogTitle>Chọn video</DialogTitle>
          <DialogDescription>
            AI đọc caption của bài và lời nói trong video bạn chọn, rồi điền công thức.
          </DialogDescription>
        </DialogHeader>

        <InputGroup>
          <InputGroupAddon>
            <SearchIcon aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm theo tác giả hoặc caption"
            aria-label="Tìm video"
          />
        </InputGroup>

        <VideoList
          rows={shown}
          hiddenCount={found.length - shown.length}
          isLoading={isLoading}
          failed={Boolean(error)}
          onPick={(row) => {
            onPick({ postId: row.post.id, mediaId: row.media.id })
            onClose()
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function VideoList({
  rows,
  hiddenCount,
  isLoading,
  failed,
  onPick,
}: {
  rows: VideoRow[]
  hiddenCount: number
  isLoading: boolean
  failed: boolean
  onPick: (row: VideoRow) => void
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2" aria-hidden>
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
    )
  }
  if (failed) {
    return (
      <p role="alert" className="text-destructive">
        Không tải được danh sách video. Thử lại nhé.
      </p>
    )
  }
  if (rows.length === 0) {
    return <p className="text-muted-foreground">Không có video nào khớp.</p>
  }
  return (
    <div className="-mx-2 max-h-[min(60dvh,32rem)] overflow-y-auto px-2">
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.media.id}>
            <VideoOption row={row} onPick={() => onPick(row)} />
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && (
        <p className="mt-3 text-center text-[0.8125rem] text-muted-foreground">
          Còn {hiddenCount} video nữa, tìm theo tác giả hoặc caption để thu hẹp.
        </p>
      )}
    </div>
  )
}

function VideoOption({ row, onPick }: { row: VideoRow; onPick: () => void }) {
  const { post, media } = row
  const duration = formatDuration(media.durationSec)
  const caption = post.body?.trim() || "Bài đăng không có chữ."
  const position = row.videoCount > 1 ? `Video ${row.position}/${row.videoCount}` : null

  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full items-start gap-3 rounded-xl border p-2 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30"
    >
      <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-muted">
        {media.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Cloudinary already serves a sized poster
          <img src={media.posterUrl} alt="" className="size-full object-cover" />
        ) : (
          <VideoIcon aria-hidden className="absolute inset-0 m-auto size-5 text-muted-foreground" />
        )}
        {duration && (
          <span className="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-[0.6875rem] text-white tabular-nums">
            {duration}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-[0.8125rem] text-muted-foreground">
          {post.author.fullName} · @{post.author.username}
          {position && ` · ${position}`}
        </p>
        <p className="line-clamp-2 break-words">{caption}</p>
        <div>
          <Badge variant={media.captionStatus === "READY" ? "secondary" : "outline"}>
            {CAPTION_LABELS[media.captionStatus]}
          </Badge>
        </div>
      </div>
    </button>
  )
}
