"use client"

import Link from "next/link"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import useSWR from "swr"
import { ArrowLeftIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/features/auth/hooks/use-auth"
import {
  DIETARY_OPTIONS_KEY,
  dietaryFormSchema,
  fetchDietaryOptions,
  fetchMyDietary,
  MY_DIETARY_KEY,
  saveMyDietary,
  type DietaryFormValues,
  type DietaryOptions,
  type DietaryRestrictions,
} from "@/features/dietary/dietary"
import { profilePath } from "@/features/profiles/profiles-cache"
import {
  NamedMultiSelect,
  type SelectOption,
} from "@/features/recipes/components/named-select"

const GROUPS_ID = "dietary-groups"
const PICKER_ID = "dietary-ingredients"
const LIKED_ID = "dietary-liked"

/** Where a user lists what they do not eat and the ingredients they like. */
export function DietaryView() {
  const { user, accessToken } = useAuth()
  const options = useSWR(
    accessToken ? ([DIETARY_OPTIONS_KEY, accessToken] as const) : null,
    fetchDietaryOptions
  )
  const mine = useSWR(
    accessToken ? ([MY_DIETARY_KEY, accessToken] as const) : null,
    fetchMyDietary
  )

  return (
    <section aria-labelledby="dietary-title">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-card/85 px-2 py-2 backdrop-blur-md">
        {user && (
          <Button
            variant="ghost"
            size="icon"
            shape="pill"
            aria-label="Quay lại hồ sơ"
            nativeButton={false}
            render={<Link href={profilePath(user.id)} />}
          >
            <ArrowLeftIcon aria-hidden />
          </Button>
        )}
        <h1 id="dietary-title" className="text-lg font-bold">
          Hồ sơ ăn uống
        </h1>
      </header>

      <div className="flex flex-col gap-6 p-4 sm:px-5">
        <p className="text-[0.9375rem] leading-6 text-muted-foreground">
          Trợ lý Vedora dùng hồ sơ này khi gợi ý món và lên thực đơn. Chỉ mình bạn thấy.
        </p>
        {options.data && mine.data && accessToken ? (
          <DietaryForm
            options={options.data}
            restrictions={mine.data}
            save={async (values) => {
              const saved = await saveMyDietary(accessToken, values)
              await mine.mutate(saved, { revalidate: false })
            }}
          />
        ) : options.error || mine.error ? (
          <p role="alert" className="text-sm text-destructive">
            Không tải được danh sách. Thử tải lại trang nhé.
          </p>
        ) : (
          <div className="flex justify-center">
            <Spinner aria-label="Đang tải" />
          </div>
        )}
      </div>
    </section>
  )
}

function DietaryForm({
  options,
  restrictions,
  save,
}: {
  options: DietaryOptions
  restrictions: DietaryRestrictions
  save: (values: DietaryFormValues) => Promise<void>
}) {
  const form = useForm<DietaryFormValues>({
    resolver: zodResolver(dietaryFormSchema),
    defaultValues: {
      groupIds: restrictions.groups.map((group) => group.id),
      ingredientIds: restrictions.ingredients.map((item) => item.id),
      likedIngredientIds: restrictions.liked.map((item) => item.id),
    },
  })
  const { isSubmitting, isDirty, isSubmitSuccessful, errors } = form.formState
  const chosen = useWatch({ control: form.control })

  // A group chosen earlier may no longer be offered; keep it listed so it can be removed.
  const groups = [
    ...options.groups,
    ...restrictions.groups
      .filter((group) => !options.groups.some((option) => option.id === group.id))
      .map((group) => ({ ...group, ingredients: [] as string[] })),
  ]
  const groupChoices: SelectOption[] = groups.map((group) => ({
    id: group.id,
    name: group.name,
    keywords: group.ingredients.join(" "),
    detail: group.ingredients.join(", "),
  }))
  const ingredientChoices: SelectOption[] = options.ingredients.map((item) => ({
    id: item.id,
    name: item.name,
    keywords: item.aliases.join(" "),
  }))

  const without = (ids: string[] | undefined) =>
    ingredientChoices.filter((option) => !ids?.includes(option.id))

  // Ingredients picked one by one that a ticked group already covers.
  const chosenGroups = groups.filter((group) => chosen.groupIds?.includes(group.id))
  const covered = options.ingredients
    .filter((item) => chosen.ingredientIds?.includes(item.id))
    .flatMap((item) => {
      const group = chosenGroups.find((candidate) =>
        candidate.ingredients.includes(item.name)
      )
      return group ? [`${item.name} (đã có trong ${group.name})`] : []
    })

  const likedButAvoided = options.ingredients
    .filter((item) => chosen.likedIngredientIds?.includes(item.id))
    .filter((item) => chosenGroups.some((group) => group.ingredients.includes(item.name)))
    .map((item) => item.name)

  async function onSubmit(values: DietaryFormValues) {
    try {
      await save(values)
      form.reset(values)
    } catch {
      form.setError("root", { message: "Không lưu được. Thử lại nhé." })
    }
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        <FieldSet>
          <FieldLegend>Thực phẩm tôi không ăn</FieldLegend>
          <FieldDescription>
            Dị ứng, tín ngưỡng hay đơn giản là không thích. Món có những thực phẩm này không
            bao giờ được đưa vào thực đơn của bạn.
          </FieldDescription>
          <FieldGroup>
            {groups.length > 0 && (
              <Controller
                name="groupIds"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor={GROUPS_ID}>Nhóm thực phẩm</FieldLabel>
                    <NamedMultiSelect
                      id={GROUPS_ID}
                      options={groupChoices}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Tìm nhóm, ví dụ: sữa, hạt, gluten"
                    />
                    {chosenGroups.length > 0 ? (
                      <ul className="flex flex-col gap-1 text-sm leading-5 text-muted-foreground">
                        {chosenGroups.map((group) => (
                          <li key={group.id}>
                            <span className="font-medium text-foreground">{group.name}</span>
                            {group.ingredients.length > 0
                              ? `: ${group.ingredients.join(", ")}`
                              : ": chưa có nguyên liệu nào"}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <FieldDescription>
                        Chọn một nhóm là tránh mọi nguyên liệu trong nhóm đó. Tìm được theo tên
                        nhóm hoặc tên nguyên liệu.
                      </FieldDescription>
                    )}
                  </Field>
                )}
              />
            )}

            <Controller
              name="ingredientIds"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={PICKER_ID}>Nguyên liệu riêng lẻ</FieldLabel>
                  <NamedMultiSelect
                    id={PICKER_ID}
                    options={without(chosen.likedIngredientIds)}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Tìm nguyên liệu, ví dụ: đậu phộng"
                    invalid={fieldState.invalid}
                  />
                  <FieldDescription>
                    {covered.length > 0
                      ? `Không cần chọn riêng: ${covered.join("; ")}.`
                      : "Dùng cho những thứ không thuộc nhóm nào ở trên. Tìm được cả tên gọi khác và không dấu."}
                  </FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>
        </FieldSet>

        <FieldSeparator />

        <Controller
          name="likedIngredientIds"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={LIKED_ID}>Nguyên liệu tôi thích</FieldLabel>
              <NamedMultiSelect
                id={LIKED_ID}
                options={without(chosen.ingredientIds)}
                value={field.value}
                onChange={field.onChange}
                placeholder="Tìm nguyên liệu bạn thích"
                invalid={fieldState.invalid}
              />
              <FieldDescription>
                {likedButAvoided.length > 0
                  ? `Đang nằm trong nhóm bạn không ăn nên sẽ không được gợi ý: ${likedButAvoided.join(", ")}.`
                  : "Trợ lý Vedora ưu tiên món có những nguyên liệu này khi gợi ý."}
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting && <Spinner aria-hidden />}
            Lưu
          </Button>
          <Button
            variant="outline"
            disabled={isSubmitting || !isDirty}
            onClick={() => form.reset()}
          >
            Huỷ thay đổi
          </Button>
          <p
            role="status"
            className={
              errors.root ? "text-sm text-destructive" : "text-sm text-muted-foreground"
            }
          >
            {errors.root
              ? errors.root.message
              : isDirty
                ? "Có thay đổi chưa lưu."
                : isSubmitSuccessful && "Đã lưu."}
          </p>
        </div>
      </FieldGroup>
    </form>
  )
}
