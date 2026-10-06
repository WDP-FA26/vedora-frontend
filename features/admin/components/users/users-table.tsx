"use client"

import {
  CircleAlertIcon,
  CopyIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DataTable,
  type DataTableView,
} from "@/features/admin/components/data-table/data-table"
import { userColumns } from "@/features/admin/components/users/user-columns"
import { useAdminUsers } from "@/features/admin/hooks/use-admin-users"
import type { AdminUser } from "@/features/admin/schemas"
import { ApiError } from "@/features/shared/lib/api-client"

const VIEWS: DataTableView[] = [
  { id: "all", label: "Tất cả", icon: UsersIcon, columnFilters: [] },
  {
    id: "admins",
    label: "Quản trị viên",
    icon: ShieldCheckIcon,
    columnFilters: [{ id: "role", value: "ADMIN" }],
  },
  {
    id: "members",
    label: "Thành viên",
    icon: UserRoundIcon,
    columnFilters: [{ id: "role", value: "USER" }],
  },
]

const getUserId = (user: AdminUser) => user.id

/** Every account on Vedora, for admins. */
export function UsersTable() {
  const { users, error, isLoading } = useAdminUsers()

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
              ? "Tài khoản của bạn không có quyền xem danh sách người dùng."
              : "Không tải được danh sách người dùng. Thử tải lại trang nhé."}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <DataTable
      columns={userColumns}
      data={users}
      getRowId={getUserId}
      views={VIEWS}
      searchPlaceholder="Tìm theo tên hoặc email"
      emptyMessage="Không có người dùng nào khớp."
      selectionActions={(table) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            navigator.clipboard.writeText(
              table
                .getFilteredSelectedRowModel()
                .rows.map((row) => row.original.email)
                .join(", ")
            )
          }
        >
          <CopyIcon aria-hidden />
          Sao chép email
        </Button>
      )}
    />
  )
}
