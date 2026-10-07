"use client"

import { createContext, use } from "react"
import { createColumnHelper } from "@tanstack/react-table"
import { CaptionsIcon, HeartIcon, MessageCircleIcon, VideoIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTableColumnHeader } from "@/features/admin/components/data-table/data-table-column-header"
import type { DataTableFeatures } from "@/features/admin/components/data-table/data-table-features"
import type { AdminPost } from "@/features/admin/schemas"
import { toAuthor } from "@/features/auth/lib/to-author"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { formatCount, formatPostDateLong } from "@/features/shared/lib/format"

const STATUS_BADGES: Record<
  AdminPost["status"],
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  PUBLISHED: { label: "Đã đăng", variant: "default" },
  PROCESSING: { label: "Đang xử lý", variant: "secondary" },
  FAILED: { label: "Lỗi", variant: "destructive" },
}

export function PostStatusBadge({ status }: { status: AdminPost["status"] }) {
  const { label, variant } = STATUS_BADGES[status]
  return <Badge variant={variant}>{label}</Badge>
}

/** Value of the `kind` column, which the "Có video" view filters on. */
export const VIDEO_POST = "video"

/** Opens a post's detail sheet; provided by the page so the columns can stay static. */
export const OpenPostContext = createContext<(id: string) => void>(() => {})

function OpenButton({ post }: { post: AdminPost }) {
  const onOpen = use(OpenPostContext)
  return (
    <Button
      variant="action"
      size="sm"
      aria-label={`Xem bài đăng của ${post.author.fullName}`}
      onClick={() => onOpen(post.id)}
    >
      Xem
    </Button>
  )
}

const helper = createColumnHelper<DataTableFeatures, AdminPost>()

export const postColumns = helper.columns([
  helper.accessor((post) => `${post.author.fullName} @${post.author.username}`, {
    id: "author",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tác giả" />
    ),
    cell: ({ row }) => {
      const { author } = row.original
      return (
        <div className="flex items-center gap-2.5">
          <AuthorAvatar author={toAuthor(author)} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium">{author.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">@{author.username}</p>
          </div>
        </div>
      )
    },
    sortFn: "text",
    enableHiding: false,
    meta: { label: "Tác giả", className: "max-w-48" },
  }),
  helper.accessor((post) => (post.media.length > 0 ? VIDEO_POST : "text"), {
    id: "kind",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Video" />,
    cell: ({ row }) => {
      const { media } = row.original
      if (media.length === 0) return <span className="text-muted-foreground">—</span>
      const transcribed = media.filter((item) => item.captionStatus === "READY").length
      return (
        <span className="flex items-center gap-3 tabular-nums">
          <span className="flex items-center gap-1.5">
            <VideoIcon aria-hidden className="size-4 text-muted-foreground" />
            <span className="sr-only">Video:</span>
            {media.length}
          </span>
          {transcribed > 0 && (
            <span className="flex items-center gap-1.5">
              <CaptionsIcon aria-hidden className="size-4 text-muted-foreground" />
              <span className="sr-only">Có bản ghi lời:</span>
              {transcribed}
            </span>
          )}
        </span>
      )
    },
    filterFn: "equalsString",
    enableGlobalFilter: false,
    meta: { label: "Video" },
  }),
  helper.accessor("status", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Trạng thái" />
    ),
    cell: ({ getValue }) => <PostStatusBadge status={getValue()} />,
    filterFn: "equalsString",
    enableGlobalFilter: false,
    meta: { label: "Trạng thái" },
  }),
  helper.accessor((post) => post.likeCount + post.commentCount, {
    id: "engagement",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tương tác" />
    ),
    cell: ({ row }) => (
      <span className="flex items-center gap-3 text-muted-foreground tabular-nums">
        <span className="flex items-center gap-1.5">
          <HeartIcon aria-hidden className="size-4" />
          <span className="sr-only">Lượt thích:</span>
          {formatCount(row.original.likeCount)}
        </span>
        <span className="flex items-center gap-1.5">
          <MessageCircleIcon aria-hidden className="size-4" />
          <span className="sr-only">Bình luận:</span>
          {formatCount(row.original.commentCount)}
        </span>
      </span>
    ),
    sortFn: "alphanumeric",
    enableGlobalFilter: false,
    meta: { label: "Tương tác", className: "hidden lg:table-cell" },
  }),
  helper.accessor("createdAt", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tạo lúc" />
    ),
    cell: ({ getValue }) => formatPostDateLong(getValue()),
    // ISO timestamps order correctly as text.
    sortFn: "text",
    enableGlobalFilter: false,
    meta: { label: "Tạo lúc", className: "hidden md:table-cell" },
  }),
  helper.display({
    id: "actions",
    cell: ({ row }) => <OpenButton post={row.original} />,
    meta: { className: "w-10" },
  }),
])
