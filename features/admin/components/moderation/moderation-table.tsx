"use client"

import { useState } from "react"
import { CircleAlertIcon, FlagIcon, ShieldAlertIcon, ShieldXIcon } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { PostSheet } from "@/features/admin/components/content/post-sheet"
import {
  DataTable,
  type DataTableView,
} from "@/features/admin/components/data-table/data-table"
import {
  QueueActionsContext,
  queueColumns,
} from "@/features/admin/components/moderation/moderation-columns"
import {
  buildQueue,
  type QueueRow,
} from "@/features/admin/components/moderation/moderation-rows"
import { useAdminPosts, useModerateAdminPost } from "@/features/admin/hooks/use-admin-posts"
import { useAdminReports, useReviewReport } from "@/features/admin/hooks/use-admin-reports"
import { ApiError } from "@/features/shared/lib/api-client"

const VIEWS: DataTableView[] = [
  {
    id: "held",
    label: "Cần xem xét",
    icon: ShieldAlertIcon,
    columnFilters: [{ id: "kind", value: "held" }],
  },
  {
    id: "report",
    label: "Bị báo cáo",
    icon: FlagIcon,
    columnFilters: [{ id: "kind", value: "report" }],
  },
  {
    id: "blocked",
    label: "Đã chặn",
    icon: ShieldXIcon,
    columnFilters: [{ id: "kind", value: "blocked" }],
  },
]

const getRowId = (row: QueueRow) => row.id

/**
 * One list for everything a person has to look at: posts the automated check
 * was unsure about, posts users reported, and posts it blocked. Each row shows
 * the chance that the post breaks the policy.
 */
export function ModerationTable() {
  const posts = useAdminPosts()
  const reports = useAdminReports()
  const moderate = useModerateAdminPost()
  const closeReport = useReviewReport()
  const [openPostId, setOpenPostId] = useState<string | null>(null)

  const error = posts.error ?? reports.error
  if (posts.isLoading || reports.isLoading) {
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
              ? "Tài khoản của bạn không có quyền xem mục này."
              : "Không tải được danh sách kiểm duyệt. Thử tải lại trang nhé."}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const actions = {
    open: setOpenPostId,
    decide: (postId: string, decision: "APPROVE" | "REJECT") => void moderate(postId, decision, ""),
    closeReport: (id: string, status: "RESOLVED" | "DISMISSED") => void closeReport(id, status),
  }

  return (
    <QueueActionsContext value={actions}>
      <DataTable
        columns={queueColumns}
        data={buildQueue(posts.posts, reports.reports)}
        getRowId={getRowId}
        views={VIEWS}
        defaultView="held"
        searchPlaceholder="Tìm theo nội dung hoặc tác giả"
        emptyMessage="Không có bài nào cần xem xét."
      />
      <PostSheet postId={openPostId} onClose={() => setOpenPostId(null)} />
    </QueueActionsContext>
  )
}
