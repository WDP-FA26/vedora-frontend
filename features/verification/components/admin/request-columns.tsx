"use client"

import { createContext, use } from "react"
import { createColumnHelper } from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTableColumnHeader } from "@/features/admin/components/data-table/data-table-column-header"
import type { DataTableFeatures } from "@/features/admin/components/data-table/data-table-features"
import { toAuthor } from "@/features/auth/lib/to-author"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { formatPostDateLong } from "@/features/shared/lib/format"
import type {
  AdminVerificationRequest,
  VerificationStatus,
} from "@/features/verification/schemas"

const STATUS_BADGES: Record<
  VerificationStatus,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  PENDING: { label: "Chờ duyệt", variant: "secondary" },
  APPROVED: { label: "Đã duyệt", variant: "default" },
  REJECTED: { label: "Từ chối", variant: "destructive" },
}

export function VerificationStatusBadge({ status }: { status: VerificationStatus }) {
  const { label, variant } = STATUS_BADGES[status]
  return <Badge variant={variant}>{label}</Badge>
}

/** Opens a request for review; provided by the page so the columns can stay static. */
export const ReviewRequestContext = createContext<(id: string) => void>(() => {})

function ReviewButton({ request }: { request: AdminVerificationRequest }) {
  const onReview = use(ReviewRequestContext)
  const pending = request.status === "PENDING"
  return (
    <Button
      variant={pending ? "outline" : "action"}
      size="sm"
      aria-label={`${pending ? "Xét duyệt" : "Xem"} yêu cầu của ${request.user.fullName}`}
      onClick={() => onReview(request.id)}
    >
      {pending ? "Xét duyệt" : "Xem"}
    </Button>
  )
}

const helper = createColumnHelper<DataTableFeatures, AdminVerificationRequest>()

export const requestColumns = helper.columns([
  helper.accessor((request) => request.user.fullName, {
    id: "applicant",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Người gửi" />
    ),
    cell: ({ row }) => {
      const { user } = row.original
      return (
        <div className="flex items-center gap-2.5">
          <AuthorAvatar author={toAuthor(user)} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium">{user.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
          </div>
        </div>
      )
    },
    sortFn: "text",
    enableHiding: false,
    meta: { label: "Người gửi", className: "max-w-56" },
  }),
  helper.accessor((request) => request.user.email, {
    id: "email",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
    sortFn: "text",
    meta: { label: "Email", className: "hidden xl:table-cell" },
  }),
  helper.accessor("status", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Trạng thái" />
    ),
    cell: ({ getValue }) => <VerificationStatusBadge status={getValue()} />,
    filterFn: "equalsString",
    enableGlobalFilter: false,
    meta: { label: "Trạng thái" },
  }),
  helper.accessor("proofCount", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Minh chứng" />
    ),
    cell: ({ getValue }) => <span className="tabular-nums">{getValue()} ảnh</span>,
    enableGlobalFilter: false,
    meta: { label: "Minh chứng", className: "hidden lg:table-cell" },
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
    cell: ({ row }) => <ReviewButton request={row.original} />,
    meta: { className: "w-10" },
  }),
])
