"use client"

import { useState, type FormEvent, type ReactNode } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/features/auth/hooks/use-auth"
import {
  ACTIVITY_LEVELS,
  ACTIVITY_LEVEL_LABELS,
  BIOLOGICAL_SEXES,
  BIOLOGICAL_SEX_LABELS,
  DIETARY_PATH,
  MAX_MEMORY_ITEM_LENGTH,
  MAX_MEMORY_ITEMS,
  memoryLines,
  NUTRITION_GOALS,
  NUTRITION_GOAL_LABELS,
  saveMyDietary,
  saveMyNutrition,
  type ActivityLevel,
  type BiologicalSex,
  type DietaryMemory,
  type NutritionGoal,
  type NutritionProfile,
} from "@/features/dietary/dietary"
import { ApiError } from "@/features/shared/lib/api-client"
import { cn } from "@/lib/utils"

export function MealPlannerOnboardingGate({
  backButton,
  initialNutrition,
  initialRestrictions,
  onCompleted,
}: {
  backButton: ReactNode
  initialNutrition: NutritionProfile
  initialRestrictions: DietaryMemory
  onCompleted: (savedNutrition: NutritionProfile, savedDietary: DietaryMemory) => Promise<void>
}) {
  const { accessToken } = useAuth()
  const currentYear = new Date().getFullYear()
  const initialNote = initialRestrictions.allergies.join("\n")

  const [heightCm, setHeightCm] = useState(initialNutrition.heightCm?.toString() ?? "")
  const [weightKg, setWeightKg] = useState(initialNutrition.weightKg?.toString() ?? "")
  const [birthYear, setBirthYear] = useState(initialNutrition.birthYear?.toString() ?? "")
  const [biologicalSex, setBiologicalSex] = useState<BiologicalSex | null>(
    initialNutrition.biologicalSex ?? null
  )
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(
    initialNutrition.activityLevel ?? null
  )
  const [nutritionGoal, setNutritionGoal] = useState<NutritionGoal | null>(
    initialNutrition.nutritionGoal ?? null
  )
  const [allergyNote, setAllergyNote] = useState(initialNote)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!accessToken || saving) return

    const heightNum = Number(heightCm.trim().replace(",", "."))
    const weightNum = Number(weightKg.trim().replace(",", "."))
    const birthYearNum = Number(birthYear.trim())

    if (!Number.isInteger(heightNum) || heightNum < 100 || heightNum > 250) {
      setError("Nhập chiều cao hợp lệ từ 100 đến 250 cm để tính định mức calo.")
      return
    }
    if (!Number.isFinite(weightNum) || weightNum < 25 || weightNum > 300) {
      setError("Nhập cân nặng hợp lệ từ 25 đến 300 kg để tính định mức calo.")
      return
    }
    if (
      !Number.isInteger(birthYearNum) ||
      birthYearNum < currentYear - 100 ||
      birthYearNum > currentYear - 13
    ) {
      setError(
        `Nhập năm sinh hợp lệ từ ${currentYear - 100} đến ${currentYear - 13} (từ 13 tuổi trở lên).`
      )
      return
    }
    if (biologicalSex === null) {
      setError("Chọn giới tính sinh học để tính chính xác năng lượng nền (BMR).")
      return
    }
    if (activityLevel === null) {
      setError("Chọn mức độ vận động hằng ngày để tính chính xác định mức calo.")
      return
    }

    const allergies = memoryLines(allergyNote)
    if (allergies.length > MAX_MEMORY_ITEMS || allergies.some((line) => line.length > MAX_MEMORY_ITEM_LENGTH)) {
      setError(`Dị ứng tối đa ${MAX_MEMORY_ITEMS} dòng, mỗi dòng tối đa ${MAX_MEMORY_ITEM_LENGTH} ký tự.`)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const [savedNutrition, savedDietary] = await Promise.all([
        saveMyNutrition(accessToken, {
          heightCm: heightNum,
          weightKg: Math.round(weightNum * 10) / 10,
          birthYear: birthYearNum,
          biologicalSex,
          activityLevel,
          nutritionGoal,
        }),
        saveMyDietary(accessToken, { allergies }),
      ])
      await onCompleted(savedNutrition, savedDietary)
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Chưa lưu được hồ sơ ăn uống. Vui lòng thử lại."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="meal-planner-onboarding-title" className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center gap-2 border-b border-border bg-card px-3 py-2.5">
        {backButton}
        <h1 id="meal-planner-onboarding-title" className="text-base font-bold">
          Cập nhật hồ sơ ăn uống trước khi lên thực đơn
        </h1>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center p-4 sm:p-6">
        <form
          onSubmit={submit}
          noValidate
          className="space-y-6 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
        >
          <div className="space-y-1">
            <h2 className="font-heading text-lg font-bold">
              Thiết lập đầy đủ chỉ số cơ thể của bạn
            </h2>
            <p className="text-xs leading-5 text-muted-foreground">
              Các chỉ số này dùng trực tiếp để tính chính xác BMR, TDEE, định mức calo mỗi ngày và loại bỏ món gây dị ứng cho bạn.
            </p>
          </div>

          <FieldGroup>
            <div className="space-y-2">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="gate-height">Chiều cao (cm) *</FieldLabel>
                  <Input
                    id="gate-height"
                    type="number"
                    required
                    min={100}
                    max={250}
                    step={1}
                    value={heightCm}
                    onChange={(event) => {
                      setHeightCm(event.target.value)
                      setError(null)
                    }}
                    placeholder="Ví dụ: 162"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="gate-weight">Cân nặng (kg) *</FieldLabel>
                  <Input
                    id="gate-weight"
                    type="number"
                    required
                    min={25}
                    max={300}
                    step={0.1}
                    value={weightKg}
                    onChange={(event) => {
                      setWeightKg(event.target.value)
                      setError(null)
                    }}
                    placeholder="Ví dụ: 55.5"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="gate-birth-year">Năm sinh *</FieldLabel>
                  <Input
                    id="gate-birth-year"
                    type="number"
                    required
                    min={currentYear - 100}
                    max={currentYear - 13}
                    step={1}
                    value={birthYear}
                    onChange={(event) => {
                      setBirthYear(event.target.value)
                      setError(null)
                    }}
                    placeholder="Ví dụ: 1996"
                  />
                </Field>
              </div>
              <FieldDescription>
                Dùng để tính chỉ số BMI và năng lượng nền (BMR) theo độ tuổi và thể trạng của bạn.
              </FieldDescription>
            </div>

            <Field>
              <FieldLabel>Giới tính sinh học *</FieldLabel>
              <div className="grid grid-cols-3 gap-2">
                {BIOLOGICAL_SEXES.map((sex) => {
                  const selected = biologicalSex === sex
                  return (
                    <button
                      key={sex}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setBiologicalSex(sex)
                        setError(null)
                      }}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                        selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background hover:bg-accent/50"
                      )}
                    >
                      {BIOLOGICAL_SEX_LABELS[sex]}
                    </button>
                  )
                })}
              </div>
              <FieldDescription>
                Ảnh hưởng đến tốc độ trao đổi chất cơ bản (BMR) khi ước tính năng lượng hằng ngày.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Mức độ vận động hằng ngày *</FieldLabel>
              <div className="grid gap-2 sm:grid-cols-2">
                {ACTIVITY_LEVELS.map((level) => {
                  const selected = activityLevel === level
                  return (
                    <button
                      key={level}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setActivityLevel(level)
                        setError(null)
                      }}
                      className={cn(
                        "flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition-colors",
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:bg-accent/50"
                      )}
                    >
                      <span className="text-xs font-semibold">
                        {ACTIVITY_LEVEL_LABELS[level].label}
                      </span>
                      <span className="text-[0.6875rem] leading-4 text-muted-foreground">
                        {ACTIVITY_LEVEL_LABELS[level].hint}
                      </span>
                    </button>
                  )
                })}
              </div>
              <FieldDescription>
                Cho biết mức tiêu hao năng lượng từ sinh hoạt và tập luyện hằng ngày (hệ số nhân BMR từ ×1,2 đến ×1,725) để tính đúng định mức calo mỗi ngày (TDEE).
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Mục tiêu thực đơn</FieldLabel>
              <div className="grid gap-2 sm:grid-cols-3">
                {NUTRITION_GOALS.map((goal) => {
                  const selected = nutritionGoal === goal
                  return (
                    <button
                      key={goal}
                      type="button"
                      onClick={() => setNutritionGoal(selected ? null : goal)}
                      className={cn(
                        "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors",
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:bg-accent/50"
                      )}
                    >
                      <span className="text-xs font-semibold">{NUTRITION_GOAL_LABELS[goal].label}</span>
                      <span className="text-[0.6875rem] leading-4 text-muted-foreground">
                        {NUTRITION_GOAL_LABELS[goal].hint}
                      </span>
                    </button>
                  )
                })}
              </div>
              <FieldDescription>
                Quyết định cách trợ lý phân bổ bữa ăn (ưu tiên bữa tối thanh nhẹ khi giảm cân, hoặc thêm món/bữa phụ khi cần bồi bổ). Có thể bỏ trống để hệ thống tự gợi ý theo BMI.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="gate-allergy-note">
                Dị ứng hoặc thực phẩm không ăn (tùy chọn, mỗi dòng một ý)
              </FieldLabel>
              <Textarea
                id="gate-allergy-note"
                rows={3}
                value={allergyNote}
                onChange={(event) => setAllergyNote(event.target.value)}
                placeholder={"Ví dụ:\nDị ứng đậu phộng\nKhông ăn đồ cay"}
              />
              <FieldDescription>
                Trợ lý sẽ tự tránh các món có nguyên liệu, gia vị hoặc cách nấu không hợp với bạn.
              </FieldDescription>
            </Field>
          </FieldGroup>

          {error && (
            <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <Button type="submit" disabled={saving}>
              {saving && <Spinner aria-hidden />}
              Lưu hồ sơ &amp; Bắt đầu lên thực đơn
            </Button>
            <Link
              href={DIETARY_PATH}
              className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
            >
              Chỉnh hồ sơ ăn uống
            </Link>
          </div>
        </form>
      </div>
    </section>
  )
}
