"use client"

import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createColumnHelper } from "@tanstack/react-table"
import { PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { DataTable } from "@/features/admin/components/data-table/data-table"
import { DataTableColumnHeader } from "@/features/admin/components/data-table/data-table-column-header"
import type { DataTableFeatures } from "@/features/admin/components/data-table/data-table-features"
import { useAuth } from "@/features/auth/hooks/use-auth"
import {
  DeleteRowDialog,
  EditButton,
  FormDialog,
  RowActions,
  RowActionsContext,
  TableStatus,
} from "@/features/recipes/components/catalog-parts"
import {
  NamedMultiSelect,
  type SelectOption,
} from "@/features/recipes/components/named-select"
import {
  useIngredientGroups,
  useIngredients,
  useRefreshRecipeCatalog,
} from "@/features/recipes/hooks/use-recipe-catalog"
import { saveIngredientGroup } from "@/features/recipes/lib/recipes-api"
import { INGREDIENT_GROUPS_KEY } from "@/features/recipes/recipes-cache"
import {
  ingredientGroupFormSchema,
  type Ingredient,
  type IngredientGroup,
  type IngredientGroupFormValues,
} from "@/features/recipes/schemas"
import { ApiError } from "@/features/shared/lib/api-client"

const helper = createColumnHelper<DataTableFeatures, IngredientGroup>()

const columns = helper.columns([
  helper.accessor("name", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nhóm" />,
    cell: ({ row }) => (
      <div className="max-w-80 min-w-40 whitespace-normal">
        <div className="flex flex-wrap items-center gap-1.5">
          <EditButton id={row.original.id}>{row.original.name}</EditButton>
          {row.original.dietary && <Badge variant="secondary">Người dùng chọn được</Badge>}
        </div>
        {row.original.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {row.original.description}
          </p>
        )}
      </div>
    ),
    sortFn: "text",
    enableHiding: false,
    meta: { label: "Nhóm" },
  }),
  helper.accessor((row) => row.ingredients.map((item) => item.name).join(", "), {
    id: "ingredients",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nguyên liệu" />,
    cell: ({ row, getValue }) =>
      row.original.ingredients.length ? (
        <p className="line-clamp-2 max-w-md whitespace-normal">
          <span className="font-medium tabular-nums">{row.original.ingredients.length}</span>
          <span className="text-muted-foreground"> · {getValue()}</span>
        </p>
      ) : (
        <span className="text-muted-foreground">Chưa có nguyên liệu</span>
      ),
    enableSorting: false,
    meta: { label: "Nguyên liệu" },
  }),
  helper.display({
    id: "actions",
    cell: ({ row }) => <RowActions id={row.original.id} name={row.original.name} />,
    meta: { className: "w-10" },
  }),
])

const getId = (row: IngredientGroup) => row.id

/** Groups of ingredients that share incompatibility rules. */
export function GroupsTable() {
  const { groups, error, isLoading } = useIngredientGroups()
  const [editing, setEditing] = useState<IngredientGroup | "new" | null>(null)
  const [deleting, setDeleting] = useState<IngredientGroup | null>(null)
  const find = (id: string) => groups.find((row) => row.id === id) ?? null

  return (
    <TableStatus isLoading={isLoading} error={error} subject="danh sách nhóm">
      <RowActionsContext
        value={{
          onEdit: (id) => setEditing(find(id)),
          onDelete: (id) => setDeleting(find(id)),
        }}
      >
        <DataTable
          columns={columns}
          data={groups}
          getRowId={getId}
          searchPlaceholder="Tìm nhóm hoặc nguyên liệu"
          emptyMessage="Chưa có nhóm nào. Nhóm giúp đặt một quy tắc cho nhiều nguyên liệu cùng lúc."
          actions={
            <Button size="sm" onClick={() => setEditing("new")}>
              <PlusIcon aria-hidden />
              Thêm nhóm
            </Button>
          }
        />
      </RowActionsContext>
      {editing !== null && (
        <GroupForm
          key={editing === "new" ? "new" : editing.id}
          group={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <DeleteRowDialog
        collection={INGREDIENT_GROUPS_KEY}
        row={deleting}
        title={`Xoá nhóm ${deleting?.name ?? ""}?`}
        description="Các quy tắc kỵ nhau của nhóm cũng bị xoá. Nguyên liệu trong nhóm vẫn được giữ."
        onClose={() => setDeleting(null)}
      />
    </TableStatus>
  )
}

const FORM_ID = "ingredient-group-form"

const toOption = (ingredient: Ingredient): SelectOption => ({
  id: ingredient.id,
  name: ingredient.name,
  keywords: ingredient.aliases.join(" "),
})

function GroupForm({
  group,
  onClose,
}: {
  group: IngredientGroup | null
  onClose: () => void
}) {
  const { accessToken } = useAuth()
  const { ingredients } = useIngredients()
  const refresh = useRefreshRecipeCatalog()
  const form = useForm<IngredientGroupFormValues>({
    resolver: zodResolver(ingredientGroupFormSchema),
    defaultValues: {
      name: group?.name ?? "",
      description: group?.description ?? "",
      dietary: group?.dietary ?? false,
      ingredientIds: group?.ingredients.map((item) => item.id) ?? [],
    },
  })
  const { isSubmitting, errors } = form.formState

  async function onSubmit(values: IngredientGroupFormValues) {
    if (!accessToken) return
    try {
      await saveIngredientGroup(accessToken, group?.id, {
        name: values.name,
        description: values.description || undefined,
        dietary: values.dietary,
        ingredientIds: values.ingredientIds,
      })
      await refresh()
      onClose()
    } catch (error) {
      if (error instanceof ApiError && error.code === "NAME_TAKEN") {
        form.setError("name", { message: "Đã có nhóm tên này." })
      } else {
        form.setError("root", { message: "Không lưu được. Thử lại nhé." })
      }
    }
  }

  return (
    <FormDialog
      open
      onClose={onClose}
      title={group ? "Sửa nhóm" : "Thêm nhóm"}
      description="Quy tắc kỵ nhau đặt cho nhóm áp dụng cho mọi nguyên liệu trong nhóm."
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
              <FieldLabel htmlFor={field.name}>Tên nhóm</FieldLabel>
              <Input
                {...field}
                id={field.name}
                autoComplete="off"
                aria-invalid={fieldState.invalid}
                placeholder="Rau giàu oxalat"
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
              <Textarea
                {...field}
                id={field.name}
                rows={2}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="dietary"
          control={form.control}
          render={({ field }) => (
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor={field.name}>Cho người dùng chọn</FieldLabel>
                <FieldDescription>
                  Hiện nhóm này trong trang “Thực phẩm tôi không ăn”, ví dụ: sản phẩm từ sữa.
                </FieldDescription>
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
        <Controller
          name="ingredientIds"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Nguyên liệu</FieldLabel>
              <NamedMultiSelect
                id={field.name}
                options={ingredients.map(toOption)}
                value={field.value}
                onChange={field.onChange}
                placeholder="Chọn nguyên liệu"
              />
            </Field>
          )}
        />
      </form>
    </FormDialog>
  )
}
