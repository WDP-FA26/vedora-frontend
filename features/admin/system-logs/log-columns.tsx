"use client"

import { createContext, use } from "react"
import { createColumnHelper } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { DataTableFeatures } from "@/features/admin/components/data-table/data-table-features"
import { formatPostDateLong } from "@/features/shared/lib/format"
import { DECISION_LABELS, RESOURCE_LABELS, type SystemLog } from "./schema"

export const SystemLogActions = createContext<{ open: (id: string) => void }>({ open: () => {} })
export function OutcomeBadge({ row }: { row: SystemLog }) {
  return (
    <Badge variant={row.outcome === "SUCCESS" ? "secondary" : "destructive"}>
      {row.outcome === "SUCCESS" ? "Thành công" : "Thất bại"}
    </Badge>
  )
}
function OpenLog({ row }: { row: SystemLog }) {
  const { open } = use(SystemLogActions)
  return (
    <Button
      variant="action"
      size="sm"
      aria-label={"Xem nhật ký " + row.requestId}
      onClick={() => open(row.id)}
    >
      Xem
    </Button>
  )
}
const helper = createColumnHelper<DataTableFeatures, SystemLog>()
export const logColumns = helper.columns([
  helper.accessor("createdAt", {
    header: "Thời gian",
    cell: ({ getValue }) => formatPostDateLong(getValue()),
    enableSorting: false,
    meta: { label: "Thời gian", className: "hidden lg:table-cell" },
  }),
  helper.accessor("actorUsername", {
    header: "Người thao tác",
    cell: ({ getValue }) => <span className="block max-w-40 truncate">@{getValue()}</span>,
    enableSorting: false,
    meta: { label: "Người thao tác", className: "hidden sm:table-cell" },
  }),
  helper.accessor("actionLabel", {
    header: "Thao tác",
    cell: ({ row }) => (
      <div className="min-w-44 max-w-72 whitespace-normal">
        <p className="line-clamp-2">{row.original.actionLabel}</p>
        <p className="truncate text-xs text-muted-foreground sm:hidden">
          @{row.original.actorUsername}
        </p>
        {row.original.decision && (
          <p className="text-xs text-muted-foreground">
            {DECISION_LABELS[row.original.decision] ?? row.original.decision}
          </p>
        )}
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
    meta: { label: "Thao tác" },
  }),
  helper.accessor("resourceType", {
    header: "Đối tượng",
    cell: ({ getValue }) => <Badge variant="outline">{RESOURCE_LABELS[getValue()]}</Badge>,
    enableSorting: false,
    meta: { label: "Đối tượng", className: "hidden md:table-cell" },
  }),
  helper.accessor("outcome", {
    header: "Kết quả",
    cell: ({ row }) => <OutcomeBadge row={row.original} />,
    enableSorting: false,
    meta: { label: "Kết quả" },
  }),
  helper.display({ id: "actions", cell: ({ row }) => <OpenLog row={row.original} /> }),
])
