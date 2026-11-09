"use client"

import { createContext, use } from "react"
import { createColumnHelper } from "@tanstack/react-table"
import { CheckIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTableColumnHeader } from "@/features/admin/components/data-table/data-table-column-header"
import type { DataTableFeatures } from "@/features/admin/components/data-table/data-table-features"
import type { QueueRow } from "@/features/admin/components/moderation/moderation-rows"
import { useCategoryLabel } from "@/features/admin/hooks/use-category-label"
import { REPORT_REASON_LABELS } from "@/features/posts/schemas"
import { formatPostDateLong } from "@/features/shared/lib/format"

/** What a row can do; provided by the page so the columns can stay static. */
export const QueueActionsContext = createContext<{
  open: (postId: string) => void
  decide: (postId: string, decision: "APPROVE" | "REJECT") => void
  closeReport: (reportId: string, status: "RESOLVED" | "DISMISSED") => void
}>({ open: () => {}, decide: () => {}, closeReport: () => {} })

/** Violation chance at which the page paints the figure as a warning. */
const HIGH_SCORE = 0.85
const MEDIUM_SCORE = 0.3

function ScoreCell({ row }: { row: QueueRow }) {
  const labelOf = useCategoryLabel()
  if (row.violationScore === null) {
    return <span className="text-muted-foreground">Chưa chấm</span>
  }
  const percent = Math.round(row.violationScore * 100)
  const tone =
    row.violationScore >= HIGH_SCORE
      ? "text-destructive"
      : row.violationScore >= MEDIUM_SCORE
        ? "text-amber-600 dark:text-amber-400"
        : "text-foreground"
  return (
    <div className="min-w-24">
      <p className={`text-base font-semibold tabular-nums ${tone}`}>{percent}%</p>
      {row.category && (
        <p className="truncate text-xs text-muted-foreground">
          {labelOf(row.category)}
        </p>
      )}
    </div>
  )
}

function ReasonCell({ row }: { row: QueueRow }) {
  if (row.kind === "report" && row.report) {
    return <Badge variant="outline">Báo cáo: {REPORT_REASON_LABELS[row.report.reason]}</Badge>
  }
  return row.kind === "held" ? (
    <Badge variant="secondary">Cần xem xét</Badge>
  ) : (
    <Badge variant="destructive">Đã chặn</Badge>
  )
}

function Actions({ row }: { row: QueueRow }) {
  const { open, decide, closeReport } = use(QueueActionsContext)
  return (
    <div className="flex items-center justify-end gap-1">
      {row.kind === "held" && (
        <Button variant="action" size="sm" onClick={() => decide(row.postId, "REJECT")}>
          <XIcon aria-hidden />
          Chặn
        </Button>
      )}
      {(row.kind === "held" || row.kind === "blocked") && (
        <Button variant="outline" size="sm" onClick={() => decide(row.postId, "APPROVE")}>
          <CheckIcon aria-hidden />
          Cho đăng
        </Button>
      )}
      {row.kind === "report" && row.report && (
        <>
          <Button
            variant="action"
            size="sm"
            onClick={() => closeReport(row.report!.id, "DISMISSED")}
          >
            Bỏ qua
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => closeReport(row.report!.id, "RESOLVED")}
          >
            Đã xử lý
          </Button>
        </>
      )}
      <Button variant="action" size="sm" onClick={() => open(row.postId)}>
        Xem
      </Button>
    </div>
  )
}

const helper = createColumnHelper<DataTableFeatures, QueueRow>()

export const queueColumns = helper.columns([
  helper.accessor("excerpt", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Bài viết" />,
    cell: ({ row }) => (
      <div className="max-w-80 min-w-48 whitespace-normal">
        <p className="line-clamp-2 break-words">{row.original.excerpt}</p>
        <p className="truncate text-xs text-muted-foreground">
          {row.original.author.fullName} · @{row.original.author.username}
        </p>
      </div>
    ),
    sortFn: "text",
    enableHiding: false,
    meta: { label: "Bài viết" },
  }),
  helper.accessor("violationScore", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Vi phạm" />,
    cell: ({ row }) => <ScoreCell row={row.original} />,
    sortFn: "alphanumeric",
    enableGlobalFilter: false,
    meta: { label: "Vi phạm" },
  }),
  helper.display({
    id: "reason",
    header: "Lý do",
    cell: ({ row }) => <ReasonCell row={row.original} />,
    meta: { label: "Lý do", className: "hidden md:table-cell" },
  }),
  helper.accessor("kind", {
    header: "Loại",
    filterFn: "equalsString",
    enableGlobalFilter: false,
    meta: { label: "Loại", className: "hidden" },
  }),
  helper.accessor("createdAt", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Lúc" />,
    cell: ({ getValue }) => formatPostDateLong(getValue()),
    sortFn: "text",
    enableGlobalFilter: false,
    meta: { label: "Lúc", className: "hidden lg:table-cell" },
  }),
  helper.display({
    id: "actions",
    cell: ({ row }) => <Actions row={row.original} />,
  }),
])
