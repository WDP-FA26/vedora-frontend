"use client"

import { createContext, use } from "react"
import { createColumnHelper } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { DataTableColumnHeader } from "@/features/admin/components/data-table/data-table-column-header"
import type { DataTableFeatures } from "@/features/admin/components/data-table/data-table-features"
import { formatPostDateLong } from "@/features/shared/lib/format"
import { VerificationStatusBadge } from "@/features/verification/components/admin/request-columns"
import type { AdminWorkspace } from "@/features/workspaces/schemas"

export const ReviewWorkspaceContext = createContext<(id: string) => void>(() => {})

function ReviewButton({ workspace }: { workspace: AdminWorkspace }) {
  const onReview = use(ReviewWorkspaceContext)
  const pending = workspace.status === "PENDING"
  return (
    <Button
      variant={pending ? "outline" : "action"}
      size="sm"
      aria-label={`${pending ? "Xét duyệt" : "Xem"} trang ${workspace.name}`}
      onClick={() => onReview(workspace.id)}
    >
      {pending ? "Xét duyệt" : "Xem"}
    </Button>
  )
}

const helper = createColumnHelper<DataTableFeatures, AdminWorkspace>()

export const workspaceColumns = helper.columns([
  helper.accessor("name", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nhà hàng" />,
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.original.name}</p>
        <p className="truncate text-xs text-muted-foreground">@{row.original.username}</p>
      </div>
    ),
    sortFn: "text",
    enableHiding: false,
    meta: { label: "Nhà hàng", className: "max-w-56" },
  }),
  helper.accessor((workspace) => workspace.owner?.fullName ?? "", {
    id: "owner",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Chủ trang" />,
    cell: ({ row }) => {
      const { owner } = row.original
      if (!owner) return <span className="text-muted-foreground">Tài khoản đã xóa</span>
      return (
        <div className="min-w-0">
          <p className="truncate">{owner.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">{owner.email}</p>
        </div>
      )
    },
    sortFn: "text",
    meta: { label: "Chủ trang", className: "hidden lg:table-cell max-w-56" },
  }),
  helper.accessor("address", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Địa chỉ" />,
    cell: ({ getValue }) => <span className="line-clamp-2">{getValue()}</span>,
    sortFn: "text",
    meta: { label: "Địa chỉ", className: "hidden xl:table-cell max-w-72" },
  }),
  helper.accessor("status", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Trạng thái" />,
    cell: ({ getValue }) => <VerificationStatusBadge status={getValue()} />,
    filterFn: "equalsString",
    enableGlobalFilter: false,
    meta: { label: "Trạng thái" },
  }),
  helper.accessor("createdAt", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Gửi lúc" />,
    cell: ({ getValue }) => formatPostDateLong(getValue()),
    sortFn: "text",
    enableGlobalFilter: false,
    meta: { label: "Gửi lúc", className: "hidden md:table-cell" },
  }),
  helper.display({
    id: "actions",
    cell: ({ row }) => <ReviewButton workspace={row.original} />,
    meta: { className: "w-10" },
  }),
])
