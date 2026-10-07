"use client"

import { createContext, use } from "react"
import { createColumnHelper } from "@tanstack/react-table"
import { CheckIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTableColumnHeader } from "@/features/admin/components/data-table/data-table-column-header"
import type { DataTableFeatures } from "@/features/admin/components/data-table/data-table-features"
import type { AdminReport } from "@/features/admin/schemas"
import { REPORT_REASON_LABELS } from "@/features/posts/schemas"
import { formatPostDateLong } from "@/features/shared/lib/format"

const STATUS_BADGES: Record<
  AdminReport["status"],
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  PENDING: { label: "Chờ xử lý", variant: "secondary" },
  RESOLVED: { label: "Đã xử lý", variant: "default" },
  DISMISSED: { label: "Bỏ qua", variant: "outline" },
}

/** What a row can do; provided by the page so the columns can stay static. */
export const ReportActionsContext = createContext<{
  openPost: (postId: string) => void
  review: (id: string, status: "RESOLVED" | "DISMISSED") => void
}>({ openPost: () => {}, review: () => {} })

function ReportActions({ report }: { report: AdminReport }) {
  const { openPost, review } = use(ReportActionsContext)
  const author = report.post.author.fullName
  return (
    <div className="flex items-center justify-end gap-1">
      {report.status === "PENDING" && (
        <>
          <Button
            variant="action"
            size="icon-sm"
            title="Bỏ qua: bài viết không vi phạm"
            aria-label={`Bỏ qua báo cáo về bài viết của ${author}`}
            onClick={() => review(report.id, "DISMISSED")}
          >
            <XIcon aria-hidden />
          </Button>
          <Button
            variant="action"
            size="icon-sm"
            title="Đánh dấu đã xử lý"
            aria-label={`Đánh dấu đã xử lý báo cáo về bài viết của ${author}`}
            onClick={() => review(report.id, "RESOLVED")}
          >
            <CheckIcon aria-hidden />
          </Button>
        </>
      )}
      <Button
        variant={report.status === "PENDING" ? "outline" : "action"}
        size="sm"
        aria-label={`Xem bài viết của ${author}`}
        onClick={() => openPost(report.postId)}
      >
        Xem bài
      </Button>
    </div>
  )
}

const helper = createColumnHelper<DataTableFeatures, AdminReport>()

export const reportColumns = helper.columns([
  helper.accessor((report) => REPORT_REASON_LABELS[report.reason], {
    id: "reason",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Lý do" />,
    cell: ({ row, getValue }) => (
      <div className="max-w-72 min-w-40 whitespace-normal">
        <p className="font-medium">{getValue()}</p>
        {row.original.details && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {row.original.details}
          </p>
        )}
      </div>
    ),
    sortFn: "text",
    enableHiding: false,
    meta: { label: "Lý do" },
  }),
  helper.accessor(
    (report) => `${report.post.author.fullName} @${report.post.author.username}`,
    {
      id: "author",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tác giả bài viết" />
      ),
      cell: ({ row }) => {
        const { author } = row.original.post
        return (
          <div className="min-w-0">
            <p className="truncate font-medium">{author.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">@{author.username}</p>
          </div>
        )
      },
      sortFn: "text",
      meta: { label: "Tác giả bài viết", className: "max-w-48" },
    }
  ),
  helper.accessor((report) => `@${report.reporter.username}`, {
    id: "reporter",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Người báo cáo" />
    ),
    sortFn: "text",
    meta: { label: "Người báo cáo", className: "hidden lg:table-cell" },
  }),
  helper.accessor("status", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Trạng thái" />
    ),
    cell: ({ getValue }) => {
      const { label, variant } = STATUS_BADGES[getValue()]
      return <Badge variant={variant}>{label}</Badge>
    },
    filterFn: "equalsString",
    enableGlobalFilter: false,
    meta: { label: "Trạng thái" },
  }),
  helper.accessor("createdAt", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Gửi lúc" />
    ),
    cell: ({ getValue }) => formatPostDateLong(getValue()),
    // ISO timestamps order correctly as text.
    sortFn: "text",
    enableGlobalFilter: false,
    meta: { label: "Gửi lúc", className: "hidden md:table-cell" },
  }),
  helper.display({
    id: "actions",
    cell: ({ row }) => <ReportActions report={row.original} />,
    meta: { className: "w-10" },
  }),
])
