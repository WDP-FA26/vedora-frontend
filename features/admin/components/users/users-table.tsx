"use client"

import { useEffect, useState } from "react"
import {
  CircleAlertIcon,
  CopyIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  DataTable,
  type DataTableView,
} from "@/features/admin/components/data-table/data-table"
import { STATUS_LABELS, userColumns } from "@/features/admin/components/users/user-columns"
import { useAdminUsers } from "@/features/admin/hooks/use-admin-users"
import { ACCOUNT_STATUSES, type AdminUser } from "@/features/admin/schemas"
import { ApiError } from "@/features/shared/lib/api-client"

/** The API's limit on `q`. */
const MAX_QUERY_LENGTH = 100
const SEARCH_DELAY_MS = 300

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

/** Every account on Vedora, for admins. The API searches and filters by status. */
export function UsersTable() {
  const [search, setSearch] = useState("")
  const [q, setQ] = useState("")
  const [status, setStatus] = useState<AdminUser["status"] | "">("")

  // One request once typing pauses, not one per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [search])

  const { users, error, isLoading, isRefreshing } = useAdminUsers({
    q: q || undefined,
    status: status || undefined,
  })

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
      searchPlaceholder="Tìm theo tên, username hoặc email"
      search={{
        value: search,
        onChange: (value) => setSearch(value.slice(0, MAX_QUERY_LENGTH)),
      }}
      actions={
        <>
          {isRefreshing && <Spinner aria-label="Đang tải danh sách" />}
          <NativeSelect
            size="sm"
            aria-label="Lọc theo trạng thái"
            value={status}
            onChange={(event) => setStatus(event.target.value as AdminUser["status"] | "")}
          >
            <NativeSelectOption value="">Mọi trạng thái</NativeSelectOption>
            {ACCOUNT_STATUSES.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {STATUS_LABELS[value]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </>
      }
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
