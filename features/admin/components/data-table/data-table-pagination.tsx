import type { ReactTable, RowData } from "@tanstack/react-table"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import type { DataTableFeatures } from "@/features/admin/components/data-table/data-table-features"

const PAGE_SIZES = [10, 20, 50, 100]

export function DataTablePagination<TData extends RowData>({
  table,
  rowCount,
  pageSizes = PAGE_SIZES,
  isPending = false,
}: {
  table: ReactTable<DataTableFeatures, TData>
  rowCount?: number
  pageSizes?: number[]
  isPending?: boolean
}) {
  const { pageIndex, pageSize } = table.state.pagination
  const pageCount = Math.max(table.getPageCount(), 1)
  const total = rowCount ?? table.getFilteredRowModel().rows.length

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t px-4 py-2.5 text-sm">
      <p className="text-muted-foreground tabular-nums">
        {table.getAllColumns().some((column) => column.id === "select")
          ? `Đã chọn ${table.getFilteredSelectedRowModel().rows.length} trong ${total} dòng`
          : `${total} dòng`}
      </p>
      <div className="flex items-center gap-4 lg:gap-6">
        <label className="hidden items-center gap-2 sm:flex">
          <span className="text-muted-foreground">Số dòng mỗi trang</span>
          <NativeSelect
            size="sm"
            value={pageSize}
            disabled={isPending}
            onChange={(event) => table.setPageSize(Number(event.target.value))}
          >
            {pageSizes.map((size) => (
              <NativeSelectOption key={size} value={size}>
                {size}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <p className="font-medium tabular-nums">
          Trang {pageIndex + 1} / {pageCount}
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon-sm"
            className="hidden lg:inline-flex"
            aria-label="Trang đầu"
            onClick={() => table.setPageIndex(0)}
            disabled={isPending || !table.getCanPreviousPage()}
          >
            <ChevronsLeftIcon aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Trang trước"
            onClick={() => table.previousPage()}
            disabled={isPending || !table.getCanPreviousPage()}
          >
            <ChevronLeftIcon aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Trang sau"
            onClick={() => table.nextPage()}
            disabled={isPending || !table.getCanNextPage()}
          >
            <ChevronRightIcon aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            className="hidden lg:inline-flex"
            aria-label="Trang cuối"
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={isPending || !table.getCanNextPage()}
          >
            <ChevronsRightIcon aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  )
}
