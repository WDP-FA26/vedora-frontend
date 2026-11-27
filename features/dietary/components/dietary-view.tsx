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
  FieldSet,
} from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/features/auth/hooks/use-auth"
import {
  dietaryFormSchema,
  fetchMyDietary,
  fetchMyNutrition,
  memoryLines,
  MY_DIETARY_KEY,
  MY_NUTRITION_KEY,
  saveMyDietary,
  type DietaryFormValues,
  type DietaryMemory,
  type SaveDietaryInput,
} from "@/features/dietary/dietary"
import {
  AsianBmiSpectrumBar,
  NutritionProfileForm,
  WeightBmiTrendChart,
} from "@/features/dietary/components/bmi-charts"
import { MEAL_PLANNER_PATH } from "@/features/meal-plan/api/meal-plan.api"
import { profilePath } from "@/features/profiles/profiles-cache"

const ALLERGIES_ID = "dietary-allergies"
const PREFERENCES_ID = "dietary-preferences"

export function DietaryView() {
  const { user, accessToken } = useAuth()
  const isPageSession = user?.accountType === "PAGE"
  const canLoadDietary = user !== null && user.accountType === "PERSONAL"
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
                key={`${nutrition.data.heightCm}-${nutrition.data.weightKg}-${nutrition.data.birthYear}-${nutrition.data.biologicalSex}-${nutrition.data.activityLevel}-${nutrition.data.nutritionGoal}`}
                profile={nutrition.data}
                onSaved={async (updated) => {
                  await nutrition.mutate(updated, { revalidate: false })
                }}
              />
            </div>
          </div>
        )}
        {mine.data && accessToken ? (
          <DietaryForm
            memory={mine.data}
            save={async (values) => {
              const saved = await saveMyDietary(accessToken, values)
              await mine.mutate(saved, { revalidate: false })
            }}
          />
        ) : mine.error ? (
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
  memory,
  save,
}: {
  memory: DietaryMemory
  save: (values: SaveDietaryInput) => Promise<void>
}) {
  const form = useForm<DietaryFormValues>({
    resolver: zodResolver(dietaryFormSchema),
    defaultValues: {
      allergies: memory.allergies.join("\n"),
      preferences: memory.preferences.join("\n"),
    },
  })
  const { isSubmitting, isDirty, isSubmitSuccessful, errors } = form.formState

  async function onSubmit(values: DietaryFormValues) {
    const allergies = memoryLines(values.allergies)
    const preferences = memoryLines(values.preferences)
    try {
      await save({ allergies, preferences })
      form.reset({ allergies: allergies.join("\n"), preferences: preferences.join("\n") })
    } catch {
      form.setError("root", { message: "Không lưu được. Thử lại nhé." })
    }
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <FieldSet>
        <FieldLegend>Ghi nhớ của trợ lý</FieldLegend>
        <FieldDescription>
          Trợ lý đọc mục này mỗi lần lên thực đơn và tự ghi thêm khi bạn kể trong lúc trò chuyện. Mỗi dòng một ý; bạn sửa hoặc xoá lúc nào cũng được.
        </FieldDescription>
        <FieldGroup>
          <Controller
            name="allergies"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={ALLERGIES_ID}>Dị ứng &amp; không ăn</FieldLabel>
                <FieldDescription>
                  Trợ lý tuyệt đối không xếp món có những thứ này vào thực đơn.
                </FieldDescription>
                <Textarea
                  id={ALLERGIES_ID}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  rows={4}
                  placeholder={"Ví dụ:\nDị ứng đậu phộng\nĂn mè bị nổi mẩn\nĂn chay ngũ vị tân"}
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="preferences"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={PREFERENCES_ID}>Sở thích &amp; thói quen</FieldLabel>
                <Textarea
                  id={PREFERENCES_ID}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  rows={4}
                  placeholder={"Ví dụ:\nKhông thích nấm\nNhà 3 người, chỉ nấu bữa tối\nMỗi món tối đa 30 phút"}
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting && <Spinner aria-hidden />}
              Lưu hồ sơ ăn uống
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
      </FieldSet>
    </form>
  )
}
