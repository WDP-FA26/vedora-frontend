"use client"

import { useState, type ReactNode } from "react"
import {
  useTable,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type ReactTable,
  type RowData,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table"
import { SearchIcon, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  features,
  type DataTableFeatures,
} from "@/features/admin/components/data-table/data-table-features"
import { DataTablePagination } from "@/features/admin/components/data-table/data-table-pagination"
import { DataTableViewOptions } from "@/features/admin/components/data-table/data-table-view-options"

/** A saved filter shown as a tab above the table. */
export type DataTableView = {
  id: string
  label: string
  icon?: LucideIcon
  columnFilters: ColumnFiltersState
}

const sameFilters = (a: ColumnFiltersState, b: ColumnFiltersState) =>
  JSON.stringify(a) === JSON.stringify(b)

/**
 * shadcn's data table (TanStack Table) laid out edge to edge: view tabs and
 * tools in one bar, the rows, then pagination.
 */
export function DataTable<TData extends RowData>({
  columns,
  data,
  getRowId,
  views = [],
  defaultView,
  searchPlaceholder = "Tìm kiếm",
  emptyMessage = "Không có kết quả.",
  selectionActions,
  actions,
}: {
  columns: ColumnDef<DataTableFeatures, TData>[]
  data: TData[]
  getRowId: (row: TData) => string
  views?: DataTableView[]
  /** Id of the view applied on first render; none means unfiltered. */
  defaultView?: string
  searchPlaceholder?: string
  emptyMessage?: ReactNode
  /** Shown in the bar while rows are selected. */
  selectionActions?: (table: ReactTable<DataTableFeatures, TData>) => ReactNode
  /** Page-level actions at the end of the bar. */
  actions?: ReactNode
}) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
    () => views.find((view) => view.id === defaultView)?.columnFilters ?? []
  )
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibilityState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const table = useTable({
    features,
    data,
    columns,
    getRowId,
    globalFilterFn: "includesString",
    initialState: { pagination: { pageIndex: 0, pageSize: 20 } },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: { sorting, columnFilters, columnVisibility, rowSelection },
  })

  const rows = table.getRowModel().rows
  const hasSelection = table.getFilteredSelectedRowModel().rows.length > 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-2 border-b px-3 py-2">
        {views.length > 0 && (
          <div className="flex items-center gap-1">
            {views.map(({ id, label, icon: Icon, columnFilters: filters }) => {
              const active = sameFilters(columnFilters, filters)
              return (
                <Button
                  key={id}
                  variant={active ? "outline" : "action"}
                  size="sm"
                  aria-pressed={active}
                  onClick={() => table.setColumnFilters(filters)}
                >
                  {Icon && <Icon aria-hidden />}
                  {label}
                </Button>
              )
            })}
          </div>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {hasSelection && selectionActions?.(table)}
          <InputGroup className="h-7 w-44 lg:w-56">
            <InputGroupAddon>
              <SearchIcon aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              value={table.state.globalFilter ?? ""}
              onChange={(event) => table.setGlobalFilter(event.target.value)}
            />
          </InputGroup>
          <DataTableViewOptions table={table} />
          {actions}
        </div>
      </div>

      <Table variant="flush">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={header.column.columnDef.meta?.className}
                >
                  {header.isPlaceholder ? null : (
                    <table.FlexRender header={header} />
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cell.column.columnDef.meta?.className}
                  >
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-32 text-center">
                <span className="text-muted-foreground">{emptyMessage}</span>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="mt-auto">
        <DataTablePagination table={table} />
      </div>
    </div>
  )
}
