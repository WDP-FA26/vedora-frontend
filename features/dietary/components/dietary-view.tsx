"use client"

import Link from "next/link"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import { ArrowLeftIcon, CalendarRangeIcon } from "lucide-react"

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
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { ApiError } from "@/features/shared/lib/api-client"
import {
  DIETARY_OPTIONS_KEY,
  dietaryFormSchema,
  fetchDietaryOptions,
  fetchMyDietary,
  fetchMyNutrition,
  MAX_ALLERGY_NOTE_LENGTH,
  MY_DIETARY_KEY,
  MY_NUTRITION_KEY,
  saveMyDietary,
  type DietaryFormValues,
  type DietaryOptions,
  type DietaryRestrictions,
} from "@/features/dietary/dietary"
import {
  AsianBmiSpectrumBar,
  NutritionProfileForm,
  WeightBmiTrendChart,
} from "@/features/dietary/components/bmi-charts"
import { MEAL_PLANNER_PATH } from "@/features/meal-plan/meal-plan"
import { profilePath } from "@/features/profiles/profiles-cache"
import {
  NamedMultiSelect,
  type SelectOption,
} from "@/features/recipes/components/named-select"

const ALLERGY_NOTE_ID = "dietary-allergy-note"
const LIKED_ID = "dietary-liked"

/** Where a user lists what they do not eat and the ingredients they like. */
export function DietaryView() {
  const { user, accessToken } = useAuth()
  const isPageSession = user?.accountType === "PAGE"
  const canLoadDietary = user !== null && user.accountType === "PERSONAL"
  const options = useAuthedSWR(canLoadDietary ? DIETARY_OPTIONS_KEY : null, fetchDietaryOptions)
  const mine = useAuthedSWR(canLoadDietary ? MY_DIETARY_KEY : null, fetchMyDietary)
  const nutrition = useAuthedSWR(canLoadDietary ? MY_NUTRITION_KEY : null, fetchMyNutrition)

  if (isPageSession) {
    return (
      <section aria-labelledby="dietary-title">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-card/85 px-2 py-2 backdrop-blur-md">
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
          <h1 id="dietary-title" className="text-lg font-bold">
            Hồ sơ ăn uống &amp; BMI
          </h1>
        </header>
        <p className="p-4 text-sm text-muted-foreground sm:px-5">
          Trang nhà hàng không có hồ sơ ăn uống.{" "}
          {user.actor
            ? `Chuyển về tài khoản @${user.actor.username} trong menu tài khoản để quản lý hồ sơ ăn uống cá nhân.`
            : "Hãy chuyển về tài khoản cá nhân để quản lý hồ sơ ăn uống."}
        </p>
      </section>
    )
  }

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
          Hồ sơ ăn uống &amp; BMI
        </h1>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          nativeButton={false}
          render={<Link href={MEAL_PLANNER_PATH} />}
        >
          <CalendarRangeIcon aria-hidden />
          Lên thực đơn
        </Button>
      </header>

      <div className="flex flex-col gap-6 p-4 sm:px-5">
        <p className="text-[0.9375rem] leading-6 text-muted-foreground">
          Trợ lý Vedora dùng hồ sơ này khi gợi ý món và cân bằng dinh dưỡng thực vật. Chỉ mình bạn thấy.
        </p>

        {nutrition.data && (
          <div className="space-y-4 border-b border-border pb-6">
            <div>
              <h2 className="font-heading text-base font-bold">Chỉ số cơ thể &amp; Mục tiêu</h2>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                Chiều cao, cân nặng và mục tiêu dùng để tính định mức calo và số lượng món ăn mỗi ngày.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <AsianBmiSpectrumBar profile={nutrition.data} />
              <WeightBmiTrendChart profile={nutrition.data} />
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-bold">Thiết lập thể trạng &amp; mục tiêu</h3>
              <NutritionProfileForm
                key={`${nutrition.data.heightCm}-${nutrition.data.weightKg}-${nutrition.data.nutritionGoal}`}
                profile={nutrition.data}
                onSaved={async (updated) => {
                  await nutrition.mutate(updated, { revalidate: false })
                }}
              />
            </div>
          </div>
        )}
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
  const legacyAvoided = [
    ...restrictions.groups.map((group) => group.name),
    ...restrictions.ingredients.map((item) => item.name),
  ]
  const existingNote = restrictions.allergyNote?.trim() ?? ""
  const initialAllergyNote = existingNote || legacyAvoided.join(", ")

  const form = useForm<DietaryFormValues>({
    resolver: zodResolver(dietaryFormSchema),
    defaultValues: {
      groupIds: [],
      ingredientIds: [],
      likedIngredientIds: restrictions.liked.map((item) => item.id),
      allergyNote: initialAllergyNote,
    },
  })
  const { isSubmitting, isDirty, isSubmitSuccessful, errors } = form.formState

  const ingredientChoices: SelectOption[] = options.ingredients.map((item) => ({
    id: item.id,
    name: item.name,
    keywords: item.aliases.join(" "),
  }))

  async function onSubmit(values: DietaryFormValues) {
    const nextValues: DietaryFormValues = {
      ...values,
      groupIds: [],
      ingredientIds: [],
    }
    try {
      await save(nextValues)
      form.reset(nextValues)
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === "CONFLICTING_PREFERENCE") {
        form.setError("root", { message: "Có xung đột trong danh sách nguyên liệu. Hãy thử lại." })
        return
      }
      form.setError("root", { message: "Không lưu được. Thử lại nhé." })
    }
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        <FieldSet>
          <FieldLegend>Thực phẩm không ăn hoặc dị ứng</FieldLegend>
          <FieldDescription>
            Loại trừ hoàn toàn món có thành phần dị ứng hoặc không hợp khi trợ lý lên lịch ăn hằng ngày.
          </FieldDescription>
          <FieldGroup>
            <Controller
              name="allergyNote"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={ALLERGY_NOTE_ID}>
                    Ghi chú dị ứng hoặc lưu ý ăn uống riêng
                  </FieldLabel>
                  <Textarea
                    id={ALLERGY_NOTE_ID}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    maxLength={MAX_ALLERGY_NOTE_LENGTH}
                    rows={3}
                    placeholder="Ví dụ: Mình dị ứng đậu phộng, mè/vừng và nước tương có gluten; ăn cay hoặc nhiều nước cốt dừa hay bị đầy bụng…"
                    aria-invalid={fieldState.invalid}
                  />
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
              <FieldLabel htmlFor={LIKED_ID}>Nguyên liệu tôi thích (tùy chọn)</FieldLabel>
              <NamedMultiSelect
                id={LIKED_ID}
                options={ingredientChoices}
                value={field.value}
                onChange={field.onChange}
                placeholder="Tìm nguyên liệu bạn thích"
                invalid={fieldState.invalid}
              />
              <FieldDescription>
                Trợ lý ưu tiên gợi ý thêm các món có nguyên liệu yêu thích vào thực đơn của bạn.
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting && <Spinner aria-hidden />}
            Lưu thực phẩm &amp; dị ứng
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
