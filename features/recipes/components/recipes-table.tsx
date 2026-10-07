"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createColumnHelper } from "@tanstack/react-table"
import { BookOpenIcon, PlusIcon, TriangleAlertIcon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  DataTable,
  type DataTableView,
} from "@/features/admin/components/data-table/data-table"
import { DataTableColumnHeader } from "@/features/admin/components/data-table/data-table-column-header"
import type { DataTableFeatures } from "@/features/admin/components/data-table/data-table-features"
import {
  DeleteRowDialog,
  RowActions,
  RowActionsContext,
  TableStatus,
} from "@/features/recipes/components/catalog-parts"
import { useRecipes } from "@/features/recipes/hooks/use-recipe-catalog"
import {
  NEW_RECIPE_PATH,
  recipeEditPath,
  RECIPES_KEY,
} from "@/features/recipes/recipes-cache"
import type { Recipe } from "@/features/recipes/schemas"
import { formatPostDateLong } from "@/features/shared/lib/format"

/** Value of the `conflicts` column, which the "Có cảnh báo" view filters on. */
const HAS_CONFLICT = "conflict"

const VIEWS: DataTableView[] = [
  { id: "all", label: "Tất cả", icon: BookOpenIcon, columnFilters: [] },
  {
    id: "conflicts",
    label: "Có cảnh báo",
    icon: TriangleAlertIcon,
    columnFilters: [{ id: "conflicts", value: HAS_CONFLICT }],
  },
]

/** Names the first incompatible pair; the rest and the reasons open on click. */
function Conflicts({ recipe }: { recipe: Recipe }) {
  const [first, ...rest] = recipe.conflicts
  if (!first) return <span className="text-muted-foreground">—</span>
  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="destructive" size="xs" />}
        aria-label={`Xem ${recipe.conflicts.length} cặp nguyên liệu kỵ nhau trong ${recipe.title}`}
      >
        <TriangleAlertIcon aria-hidden />
        {first.a.name} + {first.b.name}
        {rest.length > 0 && `, +${rest.length}`}
      </PopoverTrigger>
      <PopoverContent align="start">
        <PopoverHeader>
          <PopoverTitle>Nguyên liệu kỵ nhau</PopoverTitle>
        </PopoverHeader>
        <ul className="flex flex-col gap-3">
          {recipe.conflicts.map((conflict) => (
            <li key={`${conflict.ruleId}:${conflict.a.id}:${conflict.b.id}`}>
              <p className="font-medium">
                {conflict.a.name} và {conflict.b.name}
              </p>
              <p className="text-muted-foreground">{conflict.reason}</p>
              {conflict.source && (
                <p className="text-xs text-muted-foreground">Nguồn: {conflict.source}</p>
              )}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

const helper = createColumnHelper<DataTableFeatures, Recipe>()

const columns = helper.columns([
  helper.accessor("title", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Món" />,
    cell: ({ row }) => (
      <Link
        href={recipeEditPath(row.original.id)}
        className="block max-w-80 min-w-40 font-medium whitespace-normal underline-offset-4 hover:underline"
      >
        {row.original.title}
      </Link>
    ),
    sortFn: "text",
    enableHiding: false,
    meta: { label: "Món" },
  }),
  helper.accessor("ingredientCount", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nguyên liệu" />,
    cell: ({ getValue }) => <span className="tabular-nums">{getValue()}</span>,
    sortFn: "alphanumeric",
    enableGlobalFilter: false,
    meta: { label: "Nguyên liệu", className: "hidden sm:table-cell" },
  }),
  helper.accessor((row) => (row.prepMinutes ?? 0) + (row.cookMinutes ?? 0), {
    id: "minutes",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Thời gian" />,
    cell: ({ getValue }) =>
      getValue() > 0 ? (
        <span className="tabular-nums">{getValue()} phút</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    sortFn: "alphanumeric",
    enableGlobalFilter: false,
    meta: { label: "Thời gian", className: "hidden lg:table-cell" },
  }),
  helper.accessor((row) => (row.conflicts.length > 0 ? HAS_CONFLICT : "none"), {
    id: "conflicts",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Kỵ nhau" />,
    cell: ({ row }) => <Conflicts recipe={row.original} />,
    filterFn: "equalsString",
    enableSorting: false,
    enableGlobalFilter: false,
    meta: { label: "Kỵ nhau" },
  }),
  helper.accessor((row) => (row.post ? `@${row.post.author.username}` : ""), {
    id: "source",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Từ video của" />,
    cell: ({ getValue }) => getValue() || <span className="text-muted-foreground">—</span>,
    sortFn: "text",
    meta: { label: "Từ video của", className: "hidden md:table-cell" },
  }),
  helper.accessor("updatedAt", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Sửa lúc" />,
    cell: ({ getValue }) => formatPostDateLong(getValue()),
    // ISO timestamps order correctly as text.
    sortFn: "text",
    enableGlobalFilter: false,
    meta: { label: "Sửa lúc", className: "hidden xl:table-cell" },
  }),
  helper.display({
    id: "actions",
    cell: ({ row }) => <RowActions id={row.original.id} name={row.original.title} />,
    meta: { className: "w-10" },
  }),
])

const getId = (row: Recipe) => row.id

/** Every recipe; a row opens the editor. */
export function RecipesTable() {
  const router = useRouter()
  const { recipes, error, isLoading } = useRecipes()
  const [deleting, setDeleting] = useState<Recipe | null>(null)

  return (
    <TableStatus isLoading={isLoading} error={error} subject="danh sách công thức">
      <RowActionsContext
        value={{
          onEdit: (id) => router.push(recipeEditPath(id)),
          onDelete: (id) => setDeleting(recipes.find((row) => row.id === id) ?? null),
        }}
      >
        <DataTable
          columns={columns}
          data={recipes}
          getRowId={getId}
          views={VIEWS}
          searchPlaceholder="Tìm theo tên món"
          emptyMessage="Chưa có công thức nào ở mục này."
          actions={
            <Link href={NEW_RECIPE_PATH} className={buttonVariants({ size: "sm" })}>
              <PlusIcon aria-hidden />
              Thêm công thức
            </Link>
          }
        />
      </RowActionsContext>
      <DeleteRowDialog
        collection={RECIPES_KEY}
        row={deleting}
        title={`Xoá công thức ${deleting?.title ?? ""}?`}
        description="Công thức sẽ bị xoá vĩnh viễn. Bài đăng gốc và nguyên liệu vẫn được giữ."
        onClose={() => setDeleting(null)}
      />
    </TableStatus>
  )
}
