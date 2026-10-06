"use client"

import Link from "next/link"
import { createColumnHelper, Subscribe } from "@tanstack/react-table"
import { CopyIcon, MoreHorizontalIcon, UserRoundIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DataTableColumnHeader } from "@/features/admin/components/data-table/data-table-column-header"
import type { DataTableFeatures } from "@/features/admin/components/data-table/data-table-features"
import type { AdminUser } from "@/features/admin/schemas"
import { toAuthor } from "@/features/auth/lib/to-author"
import { profilePath } from "@/features/profiles/profiles-cache"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"

export const ROLE_LABELS: Record<AdminUser["role"], string> = {
  ADMIN: "Quản trị viên",
  USER: "Thành viên",
}

const joinedDate = new Intl.DateTimeFormat("vi", {
  dateStyle: "long",
  timeZone: "UTC",
})

const helper = createColumnHelper<DataTableFeatures, AdminUser>()

export const userColumns = helper.columns([
  helper.display({
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={
          table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Chọn tất cả trên trang"
      />
    ),
    // Subscribed, as the row object is stable and React Compiler would
    // otherwise not see its selection change.
    cell: ({ row }) => (
      <Subscribe
        source={row.table.atoms.rowSelection}
        selector={(selection) => selection[row.id]}
      >
        {(selected) => (
          <Checkbox
            checked={!!selected}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={`Chọn ${row.original.fullName}`}
          />
        )}
      </Subscribe>
    ),
    enableSorting: false,
    enableHiding: false,
    meta: { className: "w-10" },
  }),
  helper.accessor("fullName", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Người dùng" />
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-2.5">
        <AuthorAvatar author={toAuthor(row.original)} size="sm" />
        <span className="font-medium">{row.original.fullName}</span>
      </div>
    ),
    sortFn: "text",
    enableHiding: false,
    meta: { label: "Người dùng" },
  }),
  helper.accessor("username", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tên đăng nhập" />
    ),
    cell: ({ row }) => (
      <Link
        href={profilePath(row.original.id)}
        title={`@${row.original.username}`}
        className="inline-block max-w-40 truncate align-middle text-primary underline-offset-4 hover:underline"
      >
        @{row.original.username}
      </Link>
    ),
    sortFn: "text",
    meta: { label: "Tên đăng nhập" },
  }),
  helper.accessor("email", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Email" />
    ),
    sortFn: "text",
    meta: { label: "Email", className: "hidden lg:table-cell" },
  }),
  helper.accessor("createdAt", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Ngày tham gia" />
    ),
    cell: ({ getValue }) => (
      <span className="tabular-nums">
        {joinedDate.format(new Date(getValue()))}
      </span>
    ),
    // ISO timestamps order correctly as text.
    sortFn: "text",
    enableGlobalFilter: false,
    meta: { label: "Ngày tham gia", className: "hidden xl:table-cell" },
  }),
  helper.accessor("role", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Vai trò" />
    ),
    cell: ({ getValue }) => (
      <Badge variant={getValue() === "ADMIN" ? "secondary" : "outline"}>
        {ROLE_LABELS[getValue()]}
      </Badge>
    ),
    filterFn: "equalsString",
    enableGlobalFilter: false,
    meta: { label: "Vai trò" },
  }),
  helper.display({
    id: "actions",
    cell: ({ row }) => {
      const user = row.original
      return (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
<Button variant="action" size="icon-sm" />
            }
          >
            <span className="sr-only">Thao tác với {user.fullName}</span>
            <MoreHorizontalIcon aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem render={<Link href={profilePath(user.id)} />}>
              <UserRoundIcon aria-hidden />
              Xem hồ sơ
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(user.email)}
            >
              <CopyIcon aria-hidden />
              Sao chép email
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
    meta: { className: "w-10" },
  }),
])
