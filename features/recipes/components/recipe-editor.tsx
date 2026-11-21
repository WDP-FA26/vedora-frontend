"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  ArrowLeftIcon,
  PlusIcon,
  SparklesIcon,
  TriangleAlertIcon,
  VideoIcon,
  XIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { IngredientDialog } from "@/features/recipes/components/ingredient-dialog"
import { TagSelect } from "@/features/recipes/components/tag-select"
import { NamedSelect, type SelectOption } from "@/features/recipes/components/named-select"
import { RecipeAiFill, type RecipeAiHandle } from "@/features/recipes/components/recipe-ai-fill"
import { RecipeImageField } from "@/features/recipes/components/recipe-image-field"
import { RecipeSource } from "@/features/recipes/components/recipe-source"
import {
  useConflicts,
  useIngredients,
  useRecipe,
  useRefreshRecipeCatalog,
} from "@/features/recipes/hooks/use-recipe-catalog"
import { saveRecipe } from "@/features/recipes/lib/recipes-api"
import { RECIPES_PATH } from "@/features/recipes/recipes-cache"
import {
  MAX_RECIPE_INGREDIENTS,
  MAX_RECIPE_STEPS,
  recipeFormSchema,
  type DraftRecipe,
  type IngredientSuggestion,
  type RecipeDetail,
  type RecipeFormValues,
} from "@/features/recipes/schemas"
import { ApiError } from "@/features/shared/lib/api-client"

const FORM_ID = "recipe-form"
const EMPTY_INGREDIENT = { ingredientId: "", quantity: "", unit: "", note: "", draftName: "" }

/** Writes a new recipe, optionally from the post `postId`, or edits `recipeId`. */
export function RecipeEditor({
  recipeId,
  postId,
}: {
  recipeId?: string
  postId?: string
}) {
  const { recipe, error } = useRecipe(recipeId ?? null)

  if (!recipeId) return <RecipeForm recipe={null} initialPostId={postId ?? null} />
  if (recipe) {
    return (
      <RecipeForm key={recipe.id} recipe={recipe} initialPostId={recipe.post?.id ?? null} />
    )
  }
  return (
    <div className="flex flex-col gap-4 p-4">
      {error ? (
        <Alert variant="destructive">
          <TriangleAlertIcon aria-hidden />
          <AlertDescription>
            {error instanceof ApiError && error.status === 404
              ? "Công thức này đã bị xoá."
              : "Không tải được công thức. Thử tải lại trang nhé."}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3" aria-hidden>
          <Skeleton className="h-9 w-1/2" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}
    </div>
  )
}

function toFormValues(recipe: RecipeDetail | null): RecipeFormValues {
  return {
    title: recipe?.title ?? "",
    description: recipe?.description ?? "",
    imageUrl: recipe?.imageUrl ?? "",
    tag: recipe?.tag ?? "",
    servings: String(recipe?.servings ?? 2),
    prepMinutes: recipe?.prepMinutes?.toString() ?? "",
    cookMinutes: recipe?.cookMinutes?.toString() ?? "",
    caloriesPerServing: recipe?.caloriesPerServing?.toString() ?? "",
    ingredients: recipe?.ingredients.map((item) => ({
      ingredientId: item.ingredientId,
      quantity: item.quantity?.toString() ?? "",
      unit: item.unit ?? "",
      note: item.note ?? "",
      draftName: "",
    })) ?? [EMPTY_INGREDIENT],
    steps: recipe?.steps.map((text) => ({ text })) ?? [{ text: "" }],
  }
}

/** The form filled from an AI draft; the photo, and servings when AI found none, stay. */
function fromDraft(draft: DraftRecipe, current: RecipeFormValues): RecipeFormValues {
  const ingredients = draft.ingredients.map((item) => ({
    ingredientId: item.match?.id ?? "",
    quantity: item.quantity?.toString() ?? "",
    unit: item.unit ?? "",
    note: item.note ?? "",
    draftName: item.name,
  }))
  const steps = draft.steps.map((text) => ({ text }))
  return {
    title: draft.title,
    description: draft.description ?? "",
    imageUrl: current.imageUrl,
    tag: draft.tag ?? "",
    servings: draft.servings === null ? current.servings : String(draft.servings),
    prepMinutes: draft.prepMinutes?.toString() ?? "",
    cookMinutes: draft.cookMinutes?.toString() ?? "",
    caloriesPerServing: draft.caloriesPerServing?.toString() ?? "",
    ingredients: ingredients.length > 0 ? ingredients : [EMPTY_INGREDIENT],
    steps: steps.length > 0 ? steps : [{ text: "" }],
  }
}

function sameName(a: string, b: string) {
  return a.normalize("NFC").trim().toLowerCase() === b.normalize("NFC").trim().toLowerCase()
}

function RecipeForm({
  recipe,
  initialPostId,
}: {
  recipe: RecipeDetail | null
  initialPostId: string | null
}) {
  const router = useRouter()
  const { accessToken } = useAuth()
  const { ingredients: catalog } = useIngredients()
  const refresh = useRefreshRecipeCatalog()
  const aiHandle = useRef<RecipeAiHandle>(null)
  const [postId, setPostId] = useState(initialPostId)
  const [addingIngredient, setAddingIngredient] = useState(false)
  /** New-ingredient prefills from the last AI draft, by the name AI read. */
  const [suggestions, setSuggestions] = useState(new Map<string, IngredientSuggestion>())
  /** The row whose AI suggestion is open in the ingredient dialog. */
  const [creatingFor, setCreatingFor] = useState<{
    index: number
    suggestion: IngredientSuggestion
  } | null>(null)

  const form = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeFormSchema),
    defaultValues: toFormValues(recipe),
  })
  const { isSubmitting, isDirty, errors } = form.formState
  const ingredients = useFieldArray({ control: form.control, name: "ingredients" })
  const steps = useFieldArray({ control: form.control, name: "steps" })

  const chosen = useWatch({ control: form.control, name: "ingredients" })
  const conflicts = useConflicts(chosen.map((item) => item.ingredientId))

  const options: SelectOption[] = catalog.map((item) => ({
    id: item.id,
    name: item.name,
    keywords: item.aliases.join(" "),
  }))

  function fillFromDraft(draft: DraftRecipe) {
    const next = new Map<string, IngredientSuggestion>()
    for (const item of draft.ingredients) {
      if (item.suggestion) next.set(item.name, item.suggestion)
    }
    setSuggestions(next)
    form.reset(fromDraft(draft, form.getValues()), { keepDefaultValues: true })
  }

  function closeIngredientDialog() {
    setAddingIngredient(false)
    setCreatingFor(null)
  }

  async function onSubmit(values: RecipeFormValues) {
    if (!accessToken) return
    try {
      await saveRecipe(accessToken, recipe?.id, {
        title: values.title,
        description: values.description || undefined,
        imageUrl: values.imageUrl || undefined,
        tag: values.tag || null,
        servings: Number(values.servings),
        prepMinutes: values.prepMinutes ? Number(values.prepMinutes) : undefined,
        cookMinutes: values.cookMinutes ? Number(values.cookMinutes) : undefined,
        caloriesPerServing: values.caloriesPerServing ? Number(values.caloriesPerServing) : undefined,
        ingredients: values.ingredients.map((item) => ({
          ingredientId: item.ingredientId,
          quantity: item.quantity ? Number(item.quantity.replace(",", ".")) : undefined,
          unit: item.unit || undefined,
          note: item.note || undefined,
        })),
        steps: values.steps.map((step) => step.text),
        postId: postId ?? undefined,
      })
      await refresh()
      router.push(RECIPES_PATH)
    } catch {
      form.setError("root", { message: "Không lưu được công thức. Thử lại nhé." })
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-12 flex-wrap items-center gap-2 border-b px-3 py-2">
        <Link
          href={RECIPES_PATH}
          className={buttonVariants({ variant: "action", size: "sm" })}
        >
          <ArrowLeftIcon aria-hidden />
          Công thức
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {errors.root && (
            <p role="alert" className="text-sm text-destructive">
              {errors.root.message}
            </p>
          )}
          <Button
            type="button"
            variant="action"
            size="sm"
            onClick={() => aiHandle.current?.pickVideo()}
          >
            <VideoIcon aria-hidden />
            Chọn video
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => aiHandle.current?.openWithAi()}
          >
            <SparklesIcon aria-hidden />
            Điền bằng AI
          </Button>
          <Button type="submit" form={FORM_ID} size="sm" disabled={isSubmitting}>
            {isSubmitting && <Spinner aria-hidden />}
            {recipe ? "Lưu thay đổi" : "Lưu công thức"}
          </Button>
        </div>
      </div>

      <div
        className={
          postId
            ? "grid gap-6 p-4 xl:grid-cols-[minmax(0,1fr)_26rem]"
            : "mx-auto w-full max-w-3xl p-4"
        }
      >
        <form
          id={FORM_ID}
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-w-0 flex-col gap-8"
        >
          <FieldGroup>
            <Controller
              name="title"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Tên món</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    autoComplete="off"
                    aria-invalid={fieldState.invalid}
                    placeholder="Đậu hũ sốt cà chua"
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
              name="imageUrl"
              control={form.control}
              render={({ field, fieldState }) => (
                <RecipeImageField
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error}
                />
              )}
            />
            <Controller
              name="tag"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="tag">Phân loại</FieldLabel>
                  <TagSelect value={field.value} onChange={field.onChange} />
                  <FieldDescription>
                    Chọn biểu tượng món trên lịch thực đơn. Bỏ trống sẽ dùng biểu tượng mặc định.
                  </FieldDescription>
                </Field>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-4">
              {(
                [
                  { name: "servings", label: "Khẩu phần" },
                  { name: "prepMinutes", label: "Sơ chế (phút)" },
                  { name: "cookMinutes", label: "Nấu (phút)" },
                  { name: "caloriesPerServing", label: "Kcal / suất (ước tính)" },
                ] as const
              ).map(({ name, label }) => (
                <Controller
                  key={name}
                  name={name}
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        inputMode="numeric"
                        autoComplete="off"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              ))}
            </div>
          </FieldGroup>

          <FieldSet>
            <FieldLegend>Nguyên liệu</FieldLegend>
            <ul className="flex flex-col gap-3">
              {ingredients.fields.map((row, index) => {
                const rowErrors = errors.ingredients?.[index]
                const name = options.find(
                  (option) => option.id === chosen[index]?.ingredientId
                )?.name
                const labelSuffix = name ? ` của ${name}` : ` dòng ${index + 1}`
                const draftName = chosen[index]?.draftName ?? ""
                const suggestion =
                  draftName && !chosen[index]?.ingredientId
                    ? suggestions.get(draftName)
                    : undefined
                return (
                  <li key={row.id} className="flex flex-col gap-1">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,2fr)_5rem_6rem_minmax(0,1.5fr)_auto]">
                      <Controller
                        name={`ingredients.${index}.ingredientId`}
                        control={form.control}
                        render={({ field, fieldState }) => (
                          <NamedSelect
                            options={options}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Tìm nguyên liệu"
                            invalid={fieldState.invalid}
                          />
                        )}
                      />
                      <Button
                        variant="action"
                        size="icon"
                        className="sm:order-last"
                        aria-label={`Xoá nguyên liệu${labelSuffix}`}
                        disabled={ingredients.fields.length === 1}
                        onClick={() => ingredients.remove(index)}
                      >
                        <XIcon aria-hidden />
                      </Button>
                      <Input
                        {...form.register(`ingredients.${index}.quantity`)}
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="Lượng"
                        aria-label={`Lượng${labelSuffix}`}
                        aria-invalid={Boolean(rowErrors?.quantity)}
                      />
                      <Input
                        {...form.register(`ingredients.${index}.unit`)}
                        autoComplete="off"
                        placeholder="Đơn vị"
                        aria-label={`Đơn vị${labelSuffix}`}
                        aria-invalid={Boolean(rowErrors?.unit)}
                      />
                      <Input
                        {...form.register(`ingredients.${index}.note`)}
                        autoComplete="off"
                        placeholder="Ghi chú, ví dụ: cắt hạt lựu"
                        aria-label={`Ghi chú${labelSuffix}`}
                        aria-invalid={Boolean(rowErrors?.note)}
                        className="col-span-2 sm:col-span-1"
                      />
                    </div>
                    {suggestion && (
                      <div className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                        <span>AI đọc được “{draftName}”, chưa có trong danh mục.</span>
                        <Button
                          variant="link"
                          size="xs"
                          onClick={() => setCreatingFor({ index, suggestion })}
                        >
                          Tạo nguyên liệu
                        </Button>
                      </div>
                    )}
                    {draftName && name && !sameName(name, draftName) && (
                      <p className="text-sm text-muted-foreground">
                        Caption gọi là “{draftName}”.
                      </p>
                    )}
                    <FieldError
                      errors={[
                        rowErrors?.ingredientId,
                        rowErrors?.quantity,
                        rowErrors?.unit,
                        rowErrors?.note,
                      ]}
                    />
                  </li>
                )
              })}
            </ul>
            {errors.ingredients?.root && <FieldError errors={[errors.ingredients.root]} />}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={ingredients.fields.length >= MAX_RECIPE_INGREDIENTS}
                onClick={() => ingredients.append(EMPTY_INGREDIENT)}
              >
                <PlusIcon aria-hidden />
                Thêm dòng
              </Button>
              <Button
                variant="action"
                size="sm"
                disabled={ingredients.fields.length >= MAX_RECIPE_INGREDIENTS}
                onClick={() => setAddingIngredient(true)}
              >
                Chưa có trong danh mục? Tạo nguyên liệu mới
              </Button>
            </div>

            {conflicts.length > 0 && (
              <Alert>
                <TriangleAlertIcon aria-hidden />
                <AlertTitle>
                  {conflicts.length === 1
                    ? "Có một cặp nguyên liệu kỵ nhau"
                    : `Có ${conflicts.length} cặp nguyên liệu kỵ nhau`}
                </AlertTitle>
                <AlertDescription>
                  <ul className="flex flex-col gap-1">
                    {conflicts.map((conflict) => (
                      <li key={`${conflict.ruleId}:${conflict.a.id}:${conflict.b.id}`}>
                        <span className="font-medium text-foreground">
                          {conflict.a.name} và {conflict.b.name}
                        </span>
                        : {conflict.reason}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1">Bạn vẫn lưu được công thức.</p>
                </AlertDescription>
              </Alert>
            )}
          </FieldSet>

          <FieldSet>
            <FieldLegend>Cách làm</FieldLegend>
            <ol className="flex flex-col gap-3">
              {steps.fields.map((row, index) => (
                <li key={row.id} className="flex flex-col gap-1">
                  <div className="flex items-start gap-2">
                    <span
                      aria-hidden
                      className="mt-2 w-5 shrink-0 text-right text-muted-foreground tabular-nums"
                    >
                      {index + 1}.
                    </span>
                    <Textarea
                      {...form.register(`steps.${index}.text`)}
                      rows={2}
                      aria-label={`Bước ${index + 1}`}
                      aria-invalid={Boolean(errors.steps?.[index]?.text)}
                    />
                    <Button
                      variant="action"
                      size="icon"
                      aria-label={`Xoá bước ${index + 1}`}
                      disabled={steps.fields.length === 1}
                      onClick={() => steps.remove(index)}
                    >
                      <XIcon aria-hidden />
                    </Button>
                  </div>
                  <FieldError errors={[errors.steps?.[index]?.text]} className="ml-7" />
                </li>
              ))}
            </ol>
            <div>
              <Button
                variant="outline"
                size="sm"
                disabled={steps.fields.length >= MAX_RECIPE_STEPS}
                onClick={() => steps.append({ text: "" })}
              >
                <PlusIcon aria-hidden />
                Thêm bước
              </Button>
            </div>
          </FieldSet>
        </form>

        {postId && <RecipeSource postId={postId} onUnlink={() => setPostId(null)} />}
      </div>

      <IngredientDialog
        open={addingIngredient || creatingFor !== null}
        ingredient={null}
        suggestion={creatingFor?.suggestion}
        onClose={closeIngredientDialog}
        onSaved={(created) => {
          if (creatingFor) {
            form.setValue(`ingredients.${creatingFor.index}.ingredientId`, created.id, {
              shouldDirty: true,
              shouldValidate: true,
            })
            return
          }
          const blank = chosen.findIndex((item) => !item.ingredientId)
          if (blank >= 0) {
            form.setValue(`ingredients.${blank}.ingredientId`, created.id, {
              shouldDirty: true,
            })
          } else {
            ingredients.append({ ...EMPTY_INGREDIENT, ingredientId: created.id })
          }
        }}
      />

      <RecipeAiFill
        handle={aiHandle}
        postId={postId}
        hasContent={isDirty || recipe !== null}
        catalog={catalog}
        getFormSnapshot={() => form.getValues()}
        onFill={fillFromDraft}
        onLinkPost={setPostId}
      />
    </div>
  )
}
