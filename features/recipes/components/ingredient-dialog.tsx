"use client"

import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { FormDialog } from "@/features/recipes/components/catalog-parts"
import { NamedMultiSelect } from "@/features/recipes/components/named-select"
import {
  useIngredientGroups,
  useRefreshRecipeCatalog,
} from "@/features/recipes/hooks/use-recipe-catalog"
import { saveIngredient } from "@/features/recipes/lib/recipes-api"
import {
  ingredientFormSchema,
  parseAliases,
  type Ingredient,
  type IngredientFormValues,
} from "@/features/recipes/schemas"
import { ApiError } from "@/features/shared/lib/api-client"

const FORM_ID = "ingredient-form"

/** Adds an ingredient, or edits `ingredient` when given. */
export function IngredientDialog({
  open,
  ingredient,
  onClose,
  onSaved,
}: {
  open: boolean
  ingredient: Ingredient | null
  onClose: () => void
  onSaved?: (ingredient: Ingredient) => void
}) {
  return open ? (
    <IngredientForm
      key={ingredient?.id ?? "new"}
      ingredient={ingredient}
      onClose={onClose}
      onSaved={onSaved}
    />
  ) : null
}

function IngredientForm({
  ingredient,
  onClose,
  onSaved,
}: {
  ingredient: Ingredient | null
  onClose: () => void
  onSaved?: (ingredient: Ingredient) => void
}) {
  const { accessToken } = useAuth()
  const { groups } = useIngredientGroups()
  const refresh = useRefreshRecipeCatalog()
  const form = useForm<IngredientFormValues>({
    resolver: zodResolver(ingredientFormSchema),
    defaultValues: {
      name: ingredient?.name ?? "",
      aliases: ingredient?.aliases.join(", ") ?? "",
      groupIds: ingredient?.groups.map((group) => group.id) ?? [],
    },
  })
  const { isSubmitting, errors } = form.formState

  async function onSubmit(values: IngredientFormValues) {
    if (!accessToken) return
    try {
      const saved = await saveIngredient(accessToken, ingredient?.id, {
        name: values.name,
        aliases: parseAliases(values.aliases),
        groupIds: values.groupIds,
      })
      await refresh()
      onSaved?.(saved)
      onClose()
    } catch (error) {
      if (error instanceof ApiError && error.code === "NAME_TAKEN") {
        form.setError("name", { message: "Đã có nguyên liệu tên này." })
      } else {
        form.setError("root", { message: "Không lưu được. Thử lại nhé." })
      }
    }
  }

  return (
    <FormDialog
      open
      onClose={onClose}
      title={ingredient ? "Sửa nguyên liệu" : "Thêm nguyên liệu"}
      description="Công thức và quy tắc kỵ nhau đều dùng chung danh mục này."
      formId={FORM_ID}
      submitting={isSubmitting}
      rootError={errors.root?.message}
    >
      <form
        id={FORM_ID}
        noValidate
        onSubmit={(event) => {
          // The recipe editor opens this dialog inside its own form.
          event.stopPropagation()
          void form.handleSubmit(onSubmit)(event)
        }}
        className="flex flex-col gap-5"
      >
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Tên</FieldLabel>
              <Input
                {...field}
                id={field.name}
                autoComplete="off"
                aria-invalid={fieldState.invalid}
                placeholder="Đậu hũ"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="aliases"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Tên gọi khác</FieldLabel>
              <Input
                {...field}
                id={field.name}
                autoComplete="off"
                aria-invalid={fieldState.invalid}
                placeholder="đậu phụ, tofu"
              />
              <FieldDescription>
                Cách nhau bằng dấu phẩy. Giúp tìm ra nguyên liệu khi video gọi tên khác.
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="groupIds"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Nhóm</FieldLabel>
              <NamedMultiSelect
                id={field.name}
                options={groups}
                value={field.value}
                onChange={field.onChange}
                placeholder={groups.length ? "Chọn nhóm" : "Chưa có nhóm nào"}
              />
              <FieldDescription>
                Nguyên liệu nhận mọi quy tắc kỵ nhau của nhóm.
              </FieldDescription>
            </Field>
          )}
        />
      </form>
    </FormDialog>
  )
}
