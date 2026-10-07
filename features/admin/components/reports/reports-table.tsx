"use client"

import { useState } from "react"
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleXIcon,
  HourglassIcon,
  InboxIcon,
} from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { PostSheet } from "@/features/admin/components/content/post-sheet"
import {
  DataTable,
  type DataTableView,
} from "@/features/admin/components/data-table/data-table"
import {
  ReportActionsContext,
  reportColumns,
} from "@/features/admin/components/reports/report-columns"
import { useAdminReports, useReviewReport } from "@/features/admin/hooks/use-admin-reports"
import type { AdminReport } from "@/features/admin/schemas"
import { ApiError } from "@/features/shared/lib/api-client"

const VIEWS: DataTableView[] = [
  {
    id: "pending",
    label: "Chờ xử lý",
    icon: HourglassIcon,
    columnFilters: [{ id: "status", value: "PENDING" }],
  },
  {
    id: "resolved",
    label: "Đã xử lý",
    icon: CircleCheckIcon,
    columnFilters: [{ id: "status", value: "RESOLVED" }],
  },
  {
    id: "dismissed",
    label: "Bỏ qua",
    icon: CircleXIcon,
    columnFilters: [{ id: "status", value: "DISMISSED" }],
  },
  { id: "all", label: "Tất cả", icon: InboxIcon, columnFilters: [] },
]

const getReportId = (report: AdminReport) => report.id

/**
 * Posts that users reported. An admin opens the post, then deletes it there
 * (which clears its reports) or closes the report from the row.
 */
export function ReportsTable() {
  const { reports, error, isLoading } = useAdminReports()
  const review = useReviewReport()
  const [openPostId, setOpenPostId] = useState<string | null>(null)
  const actions = {
    openPost: setOpenPostId,
    review: (id: string, status: "RESOLVED" | "DISMISSED") => void review(id, status),
  }

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
              ? "Tài khoản của bạn không có quyền xem báo cáo."
              : "Không tải được danh sách báo cáo. Thử tải lại trang nhé."}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <ReportActionsContext value={actions}>
      <DataTable
        columns={reportColumns}
        data={reports}
        getRowId={getReportId}
        views={VIEWS}
        defaultView="pending"
        searchPlaceholder="Tìm theo lý do hoặc tác giả"
        emptyMessage="Không có báo cáo nào ở mục này."
      />
      <PostSheet postId={openPostId} onClose={() => setOpenPostId(null)} />
    </ReportActionsContext>
  )
}
