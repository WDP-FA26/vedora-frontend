"use client"

import Link from "next/link"
import { createColumnHelper } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { DataTableColumnHeader } from "@/features/admin/components/data-table/data-table-column-header"
import type { DataTableFeatures } from "@/features/admin/components/data-table/data-table-features"
import { formatPostDateLong } from "@/features/shared/lib/format"
import type { WorkItem } from "./schema"
import { WORK_LABELS, workItemPath } from "./work-links"

const helper = createColumnHelper<DataTableFeatures, WorkItem>()
export const workColumns = helper.columns([
  helper.accessor("title", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Việc cần làm" />,
    cell: ({ row }) => (
      <div className="min-w-40 max-w-96 whitespace-normal">
        <p className="line-clamp-2 break-words">{row.original.title}</p>
        <p className="text-xs text-muted-foreground sm:hidden">{WORK_LABELS[row.original.kind]}</p>
        {row.original.sourceCount > 1 && (
          <p className="text-xs text-muted-foreground">{row.original.sourceCount} lượt báo cáo</p>
        )}
      </div>
    ),
    sortFn: "text",
    enableHiding: false,
    meta: { label: "Việc cần làm" },
  }),
  helper.accessor("kind", {
    header: "Danh mục",
    cell: ({ getValue }) => <Badge variant="outline">{WORK_LABELS[getValue()]}</Badge>,
    meta: { label: "Danh mục", className: "hidden sm:table-cell" },
  }),
  helper.accessor("createdAt", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Thời điểm" />,
    cell: ({ getValue }) => (getValue() ? formatPostDateLong(getValue()!) : "Chưa có thời điểm"),
    sortFn: "text",
    meta: { label: "Thời điểm", className: "hidden lg:table-cell" },
  }),
  helper.display({
    id: "actions",
    cell: ({ row }) => (
      <Link
        href={workItemPath(row.original)}
        className={buttonVariants({ variant: "action", size: "sm" })}
        aria-label={`Xử lý ${row.original.title}`}
      >
        Xem
      </Link>
    ),
  }),
])
