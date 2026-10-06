"use client"

import { useState } from "react"
import {
  BadgeCheckIcon,
  CircleAlertIcon,
  CircleXIcon,
  HourglassIcon,
  InboxIcon,
} from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DataTable,
  type DataTableView,
} from "@/features/admin/components/data-table/data-table"
import { ApiError } from "@/features/shared/lib/api-client"
import {
  requestColumns,
  ReviewRequestContext,
} from "@/features/verification/components/admin/request-columns"
import { ReviewSheet } from "@/features/verification/components/admin/review-sheet"
import { useVerificationRequests } from "@/features/verification/hooks/use-verification-requests"
import type { AdminVerificationRequest } from "@/features/verification/schemas"

const VIEWS: DataTableView[] = [
  {
    id: "pending",
    label: "Chờ duyệt",
    icon: HourglassIcon,
    columnFilters: [{ id: "status", value: "PENDING" }],
  },
  {
    id: "approved",
    label: "Đã duyệt",
    icon: BadgeCheckIcon,
    columnFilters: [{ id: "status", value: "APPROVED" }],
  },
  {
    id: "rejected",
    label: "Từ chối",
    icon: CircleXIcon,
    columnFilters: [{ id: "status", value: "REJECTED" }],
  },
  { id: "all", label: "Tất cả", icon: InboxIcon, columnFilters: [] },
]

const getRequestId = (request: AdminVerificationRequest) => request.id

/** Professional verification requests, for admins to approve or reject. */
export function VerificationRequestsTable() {
  const { requests, error, isLoading } = useVerificationRequests()
  const [reviewing, setReviewing] = useState<string | null>(null)

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
              ? "Tài khoản của bạn không có quyền xét duyệt yêu cầu xác minh."
              : "Không tải được danh sách yêu cầu. Thử tải lại trang nhé."}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <ReviewRequestContext value={setReviewing}>
      <DataTable
        columns={requestColumns}
        data={requests}
        getRowId={getRequestId}
        views={VIEWS}
        defaultView="pending"
        searchPlaceholder="Tìm theo tên hoặc email"
        emptyMessage="Không có yêu cầu nào ở mục này."
      />
      <ReviewSheet requestId={reviewing} onClose={() => setReviewing(null)} />
    </ReviewRequestContext>
  )
}
