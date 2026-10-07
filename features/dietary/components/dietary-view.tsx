"use client"

import Link from "next/link"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import useSWR from "swr"
import { ArrowLeftIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
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

const PICKER_ID = "dietary-ingredients"

/** Where a user lists what they do not eat. */
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
          Thực phẩm tôi không ăn
        </h1>
      </header>

      <div className="flex flex-col gap-6 p-4 sm:px-5">
        <p className="text-[0.9375rem] leading-6 text-muted-foreground">
          Dị ứng, tín ngưỡng hay đơn giản là không thích. Chỉ mình bạn thấy danh sách này.
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
  const ingredientChoices: SelectOption[] = options.ingredients.map((item) => ({
    id: item.id,
    name: item.name,
    keywords: item.aliases.join(" "),
  }))

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
        {groups.length > 0 && (
          <Controller
            name="groupIds"
            control={form.control}
            render={({ field }) => (
              <FieldSet>
                <FieldLegend variant="label">Nhóm thực phẩm</FieldLegend>
                <FieldDescription>
                  Chọn một nhóm là tránh mọi nguyên liệu trong nhóm đó.
                </FieldDescription>
                <FieldGroup data-slot="checkbox-group">
                  {groups.map((group) => {
                    const id = `dietary-group-${group.id}`
                    return (
                      <Field key={group.id} orientation="horizontal">
                        <Checkbox
                          id={id}
                          name={field.name}
                          checked={field.value.includes(group.id)}
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked
                                ? [...field.value, group.id]
                                : field.value.filter((value) => value !== group.id)
                            )
                          }
                        />
                        <FieldContent>
                          <FieldLabel htmlFor={id}>{group.name}</FieldLabel>
                          <FieldDescription>
                            {group.ingredients.length > 0
                              ? `Gồm: ${group.ingredients.join(", ")}`
                              : "Nhóm này chưa có nguyên liệu nào."}
                          </FieldDescription>
                        </FieldContent>
                      </Field>
                    )
                  })}
                </FieldGroup>
              </FieldSet>
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
                options={ingredientChoices}
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
