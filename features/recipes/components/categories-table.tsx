"use client"

import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createColumnHelper } from "@tanstack/react-table"
import { PlusIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { DataTable } from "@/features/admin/components/data-table/data-table"
import { DataTableColumnHeader } from "@/features/admin/components/data-table/data-table-column-header"
import type { DataTableFeatures } from "@/features/admin/components/data-table/data-table-features"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { RECIPE_CATEGORY_ICON_VIEWS } from "@/features/recipes/category-icons"
import {
  DeleteRowDialog,
  EditButton,
  FormDialog,
  RowActions,
  RowActionsContext,
  TableStatus,
} from "@/features/recipes/components/catalog-parts"
import {
  useRecipeCategories,
  useRefreshRecipeCatalog,
} from "@/features/recipes/hooks/use-recipe-catalog"
import { saveRecipeCategory } from "@/features/recipes/lib/recipes-api"
import { RECIPE_CATEGORIES_KEY } from "@/features/recipes/recipes-cache"
import {
  MAX_CATEGORY_SORT_ORDER,
  RECIPE_CATEGORY_ICONS,
  recipeCategoryFormSchema,
  recipeCategoryIconSchema,
  type RecipeCategory,
  type RecipeCategoryFormValues,
} from "@/features/recipes/schemas"
import { RECIPE_TAGS, RECIPE_TAG_VIEWS, recipeTagSchema } from "@/features/recipes/tags"
import { ApiError } from "@/features/shared/lib/api-client"

const helper = createColumnHelper<DataTableFeatures, RecipeCategory>()

const columns = helper.columns([
  helper.accessor("name", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Danh mục" />,
    cell: ({ row }) => {
      const Icon = RECIPE_CATEGORY_ICON_VIEWS[row.original.icon].icon
      return (
        <div className="max-w-80 min-w-40 whitespace-normal">
          <div className="flex flex-wrap items-center gap-1.5">
            <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <EditButton id={row.original.id}>{row.original.name}</EditButton>
            {row.original.hidden && <Badge variant="secondary">Đang ẩn</Badge>}
          </div>
          {row.original.description && (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {row.original.description}
            </p>
          )}
        </div>
      )
    },
    sortFn: "text",
    enableHiding: false,
    meta: { label: "Danh mục" },
  }),
  helper.accessor((row) => RECIPE_TAG_VIEWS[row.baseTag].label, {
    id: "baseTag",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nhóm chuẩn" />,
    cell: ({ getValue }) => <span className="text-muted-foreground">{getValue()}</span>,
    sortFn: "text",
    meta: { label: "Nhóm chuẩn" },
  }),
  helper.accessor("sortOrder", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Thứ tự" />,
    cell: ({ getValue }) => <span className="tabular-nums">{getValue()}</span>,
    meta: { label: "Thứ tự", className: "w-24" },
  }),
  helper.display({
    id: "actions",
    cell: ({ row }) => <RowActions id={row.original.id} name={row.original.name} />,
    meta: { className: "w-10" },
  }),
])

const getId = (row: RecipeCategory) => row.id

/** Dish categories the admin manages; each one maps onto a fixed meal-planner kind. */
export function CategoriesTable() {
  const { categories, error, isLoading } = useRecipeCategories()
  const [editing, setEditing] = useState<RecipeCategory | "new" | null>(null)
  const [deleting, setDeleting] = useState<RecipeCategory | null>(null)
  const find = (id: string) => categories.find((row) => row.id === id) ?? null

  return (
    <TableStatus isLoading={isLoading} error={error} subject="danh sách danh mục">
      <RowActionsContext
        value={{
          onEdit: (id) => setEditing(find(id)),
          onDelete: (id) => setDeleting(find(id)),
        }}
      >
        <DataTable
          columns={columns}
          data={categories}
          getRowId={getId}
          searchPlaceholder="Tìm danh mục"
          emptyMessage="Chưa có danh mục nào."
          actions={
            <Button size="sm" onClick={() => setEditing("new")}>
              <PlusIcon aria-hidden />
              Thêm danh mục
            </Button>
          }
        />
      </RowActionsContext>
      {editing !== null && (
        <CategoryForm
          key={editing === "new" ? "new" : editing.id}
          category={editing === "new" ? null : editing}
          nextSortOrder={nextSortOrder(categories)}
          onClose={() => setEditing(null)}
        />
      )}
      <DeleteRowDialog
        collection={RECIPE_CATEGORIES_KEY}
        row={deleting}
        title={`Xoá danh mục ${deleting?.name ?? ""}?`}
        description="Danh mục bị xoá hẳn. Muốn tạm thời không cho người dùng thấy thì bật “Ẩn” thay vì xoá."
        onClose={() => setDeleting(null)}
      />
    </TableStatus>
  )
}

/** Places a new category after the last one, in steps of 10 to leave room in between. */
function nextSortOrder(categories: readonly RecipeCategory[]) {
  let highest = 0
  for (const category of categories) {
    if (category.sortOrder > highest) highest = category.sortOrder
  }
  return Math.min(highest + 10, MAX_CATEGORY_SORT_ORDER)
}

const FORM_ID = "recipe-category-form"

const TAG_ITEMS = RECIPE_TAGS.map((tag) => ({
  value: tag,
  label: RECIPE_TAG_VIEWS[tag].label,
  icon: RECIPE_TAG_VIEWS[tag].icon,
}))

const ICON_ITEMS = RECIPE_CATEGORY_ICONS.map((icon) => ({
  value: icon,
  label: RECIPE_CATEGORY_ICON_VIEWS[icon].label,
  icon: RECIPE_CATEGORY_ICON_VIEWS[icon].icon,
}))

function CategoryForm({
  category,
  nextSortOrder,
  onClose,
}: {
  category: RecipeCategory | null
  nextSortOrder: number
  onClose: () => void
}) {
  const { accessToken } = useAuth()
  const refresh = useRefreshRecipeCatalog()
  const form = useForm<RecipeCategoryFormValues>({
    resolver: zodResolver(recipeCategoryFormSchema),
    defaultValues: {
      name: category?.name ?? "",
      description: category?.description ?? "",
      baseTag: category?.baseTag ?? "RICE",
      icon: category?.icon ?? "UTENSILS",
      sortOrder: category?.sortOrder ?? nextSortOrder,
      hidden: category?.hidden ?? false,
    },
  })
  const { isSubmitting, errors } = form.formState

  async function onSubmit(values: RecipeCategoryFormValues) {
    if (!accessToken) return
    try {
      await saveRecipeCategory(accessToken, category?.id, {
        name: values.name,
        description: values.description || undefined,
        baseTag: values.baseTag,
        icon: values.icon,
        sortOrder: values.sortOrder,
        hidden: values.hidden,
      })
      await refresh()
      onClose()
    } catch (error) {
      if (error instanceof ApiError && error.code === "NAME_TAKEN") {
        form.setError("name", { message: "Đã có danh mục tên này." })
      } else {
        form.setError("root", { message: "Không lưu được. Thử lại nhé." })
      }
    }
  }

  return (
    <FormDialog
      open
      onClose={onClose}
      title={category ? "Sửa danh mục" : "Thêm danh mục"}
      description="Danh mục giúp người dùng tìm món theo loại. Nhóm chuẩn quyết định món được xếp vào bữa nào trong thực đơn."
      formId={FORM_ID}
      submitting={isSubmitting}
      rootError={errors.root?.message}
    >
      <form
        id={FORM_ID}
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
      >
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Tên danh mục</FieldLabel>
              <Input
                {...field}
                id={field.name}
                autoComplete="off"
                aria-invalid={fieldState.invalid}
                placeholder="Chè, sương sáo"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="description"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Mô tả (không bắt buộc)</FieldLabel>
              <Textarea {...field} id={field.name} rows={2} aria-invalid={fieldState.invalid} />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="baseTag"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Nhóm chuẩn</FieldLabel>
              <Select
                items={TAG_ITEMS}
                value={field.value}
                onValueChange={(next) => {
                  const parsed = recipeTagSchema.safeParse(next)
                  if (parsed.success) field.onChange(parsed.data)
                }}
              >
                <SelectTrigger id={field.name} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAG_ITEMS.map(({ value, label, icon: Icon }) => (
                    <SelectItem key={value} value={value}>
                      <Icon aria-hidden />
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                Món thuộc danh mục này được thực đơn xếp như nhóm đã chọn, ví dụ “Chè” chọn
                “Tráng miệng”.
              </FieldDescription>
            </Field>
          )}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Controller
            name="icon"
            control={form.control}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Biểu tượng</FieldLabel>
                <Select
                  items={ICON_ITEMS}
                  value={field.value}
                  onValueChange={(next) => {
                    const parsed = recipeCategoryIconSchema.safeParse(next)
                    if (parsed.success) field.onChange(parsed.data)
                  }}
                >
                  <SelectTrigger id={field.name} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_ITEMS.map(({ value, label, icon: Icon }) => (
                      <SelectItem key={value} value={value}>
                        <Icon aria-hidden />
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
          <Controller
            name="sortOrder"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Thứ tự hiển thị</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MAX_CATEGORY_SORT_ORDER}
                  value={Number.isNaN(field.value) ? "" : field.value}
                  onChange={(event) => field.onChange(event.target.valueAsNumber)}
                  onBlur={field.onBlur}
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </div>
        <Controller
          name="hidden"
          control={form.control}
          render={({ field }) => (
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor={field.name}>Ẩn khỏi người dùng</FieldLabel>
                <FieldDescription>Giữ lại danh mục nhưng không hiển thị cho người dùng.</FieldDescription>
              </FieldContent>
              <Switch
                id={field.name}
                name={field.name}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </Field>
          )}
        />
      </form>
    </FormDialog>
  )
}
