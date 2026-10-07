"use client"

import { useState } from "react"
import {
  CircleAlertIcon,
  CircleCheckIcon,
  FileTextIcon,
  HourglassIcon,
  TriangleAlertIcon,
  VideoIcon,
} from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
  OpenPostContext,
  postColumns,
  VIDEO_POST,
} from "@/features/admin/components/content/post-columns"
import { PostSheet } from "@/features/admin/components/content/post-sheet"
import {
  DataTable,
  type DataTableView,
} from "@/features/admin/components/data-table/data-table"
import { useAdminPosts } from "@/features/admin/hooks/use-admin-posts"
import type { AdminPost } from "@/features/admin/schemas"
import { ApiError } from "@/features/shared/lib/api-client"

const VIEWS: DataTableView[] = [
  { id: "all", label: "Tất cả", icon: FileTextIcon, columnFilters: [] },
  {
    id: "video",
    label: "Có video",
    icon: VideoIcon,
    columnFilters: [{ id: "kind", value: VIDEO_POST }],
  },
  {
    id: "published",
    label: "Đã đăng",
    icon: CircleCheckIcon,
    columnFilters: [{ id: "status", value: "PUBLISHED" }],
  },
  {
    id: "processing",
    label: "Đang xử lý",
    icon: HourglassIcon,
    columnFilters: [{ id: "status", value: "PROCESSING" }],
  },
  {
    id: "failed",
    label: "Lỗi",
    icon: TriangleAlertIcon,
    columnFilters: [{ id: "status", value: "FAILED" }],
  },
]

const getPostId = (post: AdminPost) => post.id

/** Every post on Vedora whatever its status; its text, videos and transcripts open in a sheet. */
export function PostsTable() {
  const { posts, error, isLoading } = useAdminPosts()
  const [openId, setOpenId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="space-y-2 p-4" aria-hidden>
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden />
          <AlertDescription>
            {error instanceof ApiError && error.status === 403
              ? "Tài khoản của bạn không có quyền xem danh sách bài đăng."
              : "Không tải được danh sách bài đăng. Thử tải lại trang nhé."}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <OpenPostContext value={setOpenId}>
      <DataTable
        columns={postColumns}
        data={posts}
        getRowId={getPostId}
        views={VIEWS}
        searchPlaceholder="Tìm theo tác giả"
        emptyMessage="Không có bài đăng nào ở mục này."
      />
      <PostSheet postId={openId} onClose={() => setOpenId(null)} />
    </OpenPostContext>
  )
}
