"use client"

import { createContext, use } from "react"
import { createColumnHelper } from "@tanstack/react-table"
import { CheckIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTableColumnHeader } from "@/features/admin/components/data-table/data-table-column-header"
import type { DataTableFeatures } from "@/features/admin/components/data-table/data-table-features"
import type { QueueRow } from "@/features/admin/components/moderation/moderation-rows"
import { RiskLevelBadge } from "@/features/admin/components/moderation/risk-level-badge"
import { useCategoryLabel } from "@/features/admin/hooks/use-category-label"
import { REPORT_REASON_LABELS } from "@/features/posts/schemas"
import { formatPostDateLong } from "@/features/shared/lib/format"

export const QueueActionsContext = createContext<{
  open: (postId: string) => void
  decide: (postId: string, decision: "APPROVE" | "REJECT") => void
  dismissReport: (reportId: string) => void
}>({ open: () => {}, decide: () => {}, dismissReport: () => {} })

function RiskCell({ row }: { row: QueueRow }) {
  const labelOf = useCategoryLabel()
  return (
    <div className="flex min-w-24 flex-col items-start gap-1">
      <RiskLevelBadge level={row.riskLevel} />
      {row.category && (
        <p className="max-w-full truncate text-xs text-muted-foreground">{labelOf(row.category)}</p>
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
  const { open, decide, dismissReport } = use(QueueActionsContext)
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
      {row.kind === "report" && row.report && row.pendingReportCount === 1 && (
        <Button
          variant="action"
          size="sm"
          onClick={() => dismissReport(row.report!.id)}
        >
          Bỏ qua
        </Button>
      )}
      <Button variant="action" size="sm" onClick={() => open(row.postId)}>
        Xem
      </Button>
    </div>
  )
}

function ExcerptCell({ row }: { row: QueueRow }) {
  const { open } = use(QueueActionsContext)
  return (
    <div className="max-w-80 min-w-48 whitespace-normal">
      <button
        type="button"
        className="block w-full cursor-pointer text-left hover:underline focus-visible:underline focus-visible:outline-none"
        onClick={() => open(row.postId)}
      >
        <span className="line-clamp-2 break-words">{row.excerpt}</span>
      </button>
      <p className="truncate text-xs text-muted-foreground">
        {row.author.fullName} · @{row.author.username}
      </p>
    </div>
  )
}

const helper = createColumnHelper<DataTableFeatures, QueueRow>()

export const queueColumns = helper.columns([
  helper.accessor("excerpt", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Bài viết" />,
    cell: ({ row }) => <ExcerptCell row={row.original} />,
    sortFn: "text",
    enableHiding: false,
    meta: { label: "Bài viết" },
  }),
  helper.accessor((row) => row.riskLevel ?? undefined, {
    id: "riskLevel",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Mức rủi ro" />,
    cell: ({ row }) => <RiskCell row={row.original} />,
    sortFn: "alphanumeric",
    sortUndefined: "last",
    enableGlobalFilter: false,
    meta: { label: "Mức rủi ro" },
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
  helper.accessor((row) => row.reportCount ?? 0, {
    id: "reportCount",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Lượt báo cáo" />,
    cell: ({ row }) =>
      row.original.kind === "report" ? (
        <div className="text-sm tabular-nums">
          <p>{row.original.reportCount} lượt</p>
          <p className="text-xs text-muted-foreground">
            {row.original.pendingReportCount} chờ xử lý
          </p>
        </div>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    sortFn: "alphanumeric",
    enableGlobalFilter: false,
    meta: { label: "Lượt báo cáo" },
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
