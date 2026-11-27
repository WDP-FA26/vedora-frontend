"use client"

import { createContext, use } from "react"
import { createColumnHelper } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTableColumnHeader } from "@/features/admin/components/data-table/data-table-column-header"
import type { DataTableFeatures } from "@/features/admin/components/data-table/data-table-features"
import { REPORT_REASON_LABELS } from "@/features/posts/schemas"
import { formatPostDateLong } from "@/features/shared/lib/format"
import type { AdminCommentReport, CommentReportStatus } from "./schema"
import type { CommentReportGroup } from "./report-groups"

export const REPORT_STATUS_LABELS: Record<CommentReportStatus, string> = {
  PENDING: "Chờ xử lý",
  RESOLVED: "Đã xử lý",
  DISMISSED: "Đã bỏ qua",
}

export function CommentReportStatusBadge({ status }: { status: CommentReportStatus }) {
  return (
    <Badge variant={status === "PENDING" ? "secondary" : "outline"}>
      {REPORT_STATUS_LABELS[status]}
    </Badge>
  )
}

export const CommentReportActionsContext = createContext<{
  open: (id: string) => void
  dismiss: (report: AdminCommentReport) => void
  remove: (id: string) => void
  busy: boolean
}>({ open: () => {}, dismiss: () => {}, remove: () => {}, busy: false })

function Actions({ report }: { report: CommentReportGroup }) {
  const { open, dismiss, remove, busy } = use(CommentReportActionsContext)
  return (
    <div className="flex items-center justify-end gap-1">
      {report.status === "PENDING" && (
        <>
          {report.pendingReportCount === 1 && (
            <Button
              variant="action"
              size="sm"
              aria-label="Bỏ qua báo cáo"
              disabled={busy}
              onClick={() => dismiss(report)}
            >
              Bỏ qua
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => remove(report.id)}
            aria-label={report.comment.isAvailable ? "Gỡ bình luận" : "Xác nhận đã xóa"}
          >
            {report.comment.isAvailable ? "Gỡ" : "Đã xóa"}
          </Button>
        </>
      )}
      <Button
        variant="action"
        size="sm"
        onClick={() => open(report.commentId)}
        aria-label={`Xem báo cáo bình luận của ${report.comment.author.fullName}`}
      >
        Xem
      </Button>
    </div>
  )
}

const helper = createColumnHelper<DataTableFeatures, CommentReportGroup>()

export const commentReportColumns = helper.columns([
  helper.accessor(
    (report) =>
      `${report.reports.map((row) => row.comment.body).join(" ")} ${report.comment.currentBody ?? ""} ${report.comment.author.fullName} ${report.comment.author.username}`,
    {
      id: "comment",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Bình luận" />,
      cell: ({ row }) => (
        <div className="max-w-80 min-w-48 whitespace-normal">
          <p className="line-clamp-2 break-words">
            {row.original.comment.currentBody ?? row.original.comment.body}
          </p>
          <p className="text-xs text-muted-foreground">
            {row.original.reportCount} lượt báo cáo · {row.original.pendingReportCount} chờ xử lý
          </p>
          {row.original.reports.some((report) => report.comment.isEdited) && (
            <Badge variant="outline">Đã chỉnh sửa sau báo cáo</Badge>
          )}
          <p className="truncate text-xs text-muted-foreground">
            {row.original.comment.author.fullName} · @{row.original.comment.author.username}
          </p>
        </div>
      ),
      sortFn: "text",
      enableHiding: false,
      meta: { label: "Bình luận" },
    }
  ),
  helper.accessor("reason", {
    header: "Lý do",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {[...new Set(row.original.reports.map((report) => report.reason))].map((reason) => (
          <Badge key={reason} variant="outline">
            {REPORT_REASON_LABELS[reason]}
          </Badge>
        ))}
      </div>
    ),
    enableGlobalFilter: false,
    meta: { label: "Lý do", className: "hidden md:table-cell" },
  }),
  helper.accessor("status", {
    header: "Trạng thái",
    cell: ({ row, getValue }) => (
      <div className="space-y-1">
        <CommentReportStatusBadge status={getValue()} />
        <p className="text-xs text-muted-foreground">
          {row.original.resolvedReportCount} đã xử lý · {row.original.dismissedReportCount} đã bỏ
          qua
        </p>
      </div>
    ),
    filterFn: (row, _columnId, value) => {
      if (value === "PENDING") return row.original.pendingReportCount > 0
      if (value === "RESOLVED") return row.original.resolvedReportCount > 0
      if (value === "DISMISSED") return row.original.dismissedReportCount > 0
      return true
    },
    enableGlobalFilter: false,
    meta: { label: "Trạng thái", className: "hidden md:table-cell" },
  }),
  helper.accessor((report) => report.reporter?.fullName ?? "Tài khoản không còn tồn tại", {
    id: "reporter",
    header: "Người báo cáo",
    cell: ({ row }) => <span>{row.original.reportCount} lượt · Xem chi tiết</span>,
    sortFn: "text",
    enableGlobalFilter: false,
    meta: { label: "Người báo cáo", className: "hidden xl:table-cell" },
  }),
  helper.accessor("createdAt", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Lúc" />,
    cell: ({ getValue }) => formatPostDateLong(getValue()),
    sortFn: "text",
    enableGlobalFilter: false,
    meta: { label: "Lúc", className: "hidden lg:table-cell" },
  }),
  helper.display({ id: "actions", cell: ({ row }) => <Actions report={row.original} /> }),
])
