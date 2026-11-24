"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  BadgeCheckIcon,
  CircleAlertIcon,
  CircleXIcon,
  HourglassIcon,
  InboxIcon,
} from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable, type DataTableView } from "@/features/admin/components/data-table/data-table"
import { ApiError } from "@/features/shared/lib/api-client"
import {
  ReviewWorkspaceContext,
  workspaceColumns,
} from "@/features/workspaces/components/admin/workspace-columns"
import { WorkspaceReviewSheet } from "@/features/workspaces/components/admin/workspace-review-sheet"
import { useAdminWorkspaces } from "@/features/workspaces/hooks/use-admin-workspaces"
import type { AdminWorkspace } from "@/features/workspaces/schemas"

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

const getWorkspaceId = (workspace: AdminWorkspace) => workspace.id

function loadErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 403) {
    return "Tài khoản của bạn không có quyền xét duyệt trang nhà hàng."
  }
  return "Không tải được danh sách đơn. Thử tải lại trang nhé."
}

/** Restaurant page applications, for admins to approve or reject. */
export function AdminWorkspacesTable() {
  const params = useSearchParams()
  const { workspaces, error, isLoading } = useAdminWorkspaces()
  const [reviewing, setReviewing] = useState<string | null>(() => params.get("workspaceId"))

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
          <AlertDescription>{loadErrorMessage(error)}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <ReviewWorkspaceContext value={setReviewing}>
      <DataTable
        columns={workspaceColumns}
        data={workspaces}
        getRowId={getWorkspaceId}
        views={VIEWS}
        defaultView="pending"
        searchPlaceholder="Tìm theo tên nhà hàng, chủ trang hoặc địa chỉ"
        emptyMessage="Không có đơn nào ở mục này."
      />
      <WorkspaceReviewSheet workspaceId={reviewing} onClose={() => setReviewing(null)} />
    </ReviewWorkspaceContext>
  )
}
