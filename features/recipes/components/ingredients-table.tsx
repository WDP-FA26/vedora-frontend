"use client"

import { useState } from "react"
import { createColumnHelper } from "@tanstack/react-table"
import { PlusIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/features/admin/components/data-table/data-table"
import { DataTableColumnHeader } from "@/features/admin/components/data-table/data-table-column-header"
import type { DataTableFeatures } from "@/features/admin/components/data-table/data-table-features"
import {
  DeleteRowDialog,
  EditButton,
  RowActions,
  RowActionsContext,
  TableStatus,
} from "@/features/recipes/components/catalog-parts"
import { IngredientDialog } from "@/features/recipes/components/ingredient-dialog"
import { useIngredients } from "@/features/recipes/hooks/use-recipe-catalog"
import { INGREDIENTS_KEY } from "@/features/recipes/recipes-cache"
import type { Ingredient } from "@/features/recipes/schemas"

const helper = createColumnHelper<DataTableFeatures, Ingredient>()

const columns = helper.columns([
  // Aliases are part of the value so the search box finds them.
  helper.accessor((row) => [row.name, ...row.aliases].join(" "), {
    id: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nguyên liệu" />,
    cell: ({ row }) => (
      <div className="min-w-40 whitespace-normal">
        <EditButton id={row.original.id}>{row.original.name}</EditButton>
        {row.original.aliases.length > 0 && (
          <p className="text-xs text-muted-foreground">{row.original.aliases.join(", ")}</p>
        )}
      </div>
    ),
    sortFn: "text",
    enableHiding: false,
    meta: { label: "Nguyên liệu" },
  }),
  helper.accessor((row) => row.groups.map((group) => group.name).join(" "), {
    id: "groups",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nhóm" />,
    cell: ({ row }) =>
      row.original.groups.length ? (
        <div className="flex flex-wrap gap-1">
          {row.original.groups.map((group) => (
            <Badge key={group.id} variant="secondary">
              {group.name}
            </Badge>
          ))}
        </div>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    enableSorting: false,
    meta: { label: "Nhóm", className: "hidden md:table-cell" },
  }),
  helper.accessor("recipeCount", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Công thức" />,
    cell: ({ getValue }) => <span className="tabular-nums">{getValue()}</span>,
    sortFn: "alphanumeric",
    enableGlobalFilter: false,
    meta: { label: "Công thức", className: "hidden sm:table-cell" },
  }),
  helper.display({
    id: "actions",
    cell: ({ row }) => (
      <RowActions
        id={row.original.id}
        name={row.original.name}
        deleteBlockedReason={
          row.original.recipeCount > 0
            ? `Đang dùng trong ${row.original.recipeCount} công thức, chưa xoá được`
            : undefined
        }
      />
    ),
    meta: { className: "w-10" },
  }),
])

const getId = (row: Ingredient) => row.id

/** The ingredient catalog that recipes and incompatibility rules point at. */
export function IngredientsTable() {
  const { ingredients, error, isLoading } = useIngredients()
  const [editing, setEditing] = useState<Ingredient | "new" | null>(null)
  const [deleting, setDeleting] = useState<Ingredient | null>(null)
  const find = (id: string) => ingredients.find((row) => row.id === id) ?? null

  return (
    <TableStatus isLoading={isLoading} error={error} subject="danh sách nguyên liệu">
      <RowActionsContext
        value={{
          onEdit: (id) => setEditing(find(id)),
          onDelete: (id) => setDeleting(find(id)),
        }}
      >
        <DataTable
          columns={columns}
          data={ingredients}
          getRowId={getId}
          searchPlaceholder="Tìm nguyên liệu"
          emptyMessage="Chưa có nguyên liệu nào."
          actions={
            <Button size="sm" onClick={() => setEditing("new")}>
              <PlusIcon aria-hidden />
              Thêm nguyên liệu
            </Button>
          }
        />
      </RowActionsContext>
      <IngredientDialog
        open={editing !== null}
        ingredient={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
      />
      <DeleteRowDialog
        collection={INGREDIENTS_KEY}
        row={deleting}
        title={`Xoá ${deleting?.name ?? "nguyên liệu"}?`}
        description="Nguyên liệu sẽ bị gỡ khỏi các nhóm, và các quy tắc kỵ nhau nhắc riêng tới nó cũng bị xoá."
        inUseMessage="Vẫn có công thức dùng nguyên liệu này. Gỡ nó khỏi các công thức trước nhé."
        onClose={() => setDeleting(null)}
      />
    </TableStatus>
  )
}
