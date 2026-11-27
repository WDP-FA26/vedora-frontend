"use client"

import { useState, type FormEvent } from "react"
import { SearchIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { createMealLogEntry, estimateCalories } from "@/features/meal-plan/api/meal-log.api"
import {
  kcal,
  logErrorMessage,
  parseCalories,
  parseServings,
  sectionForNow,
} from "@/features/meal-plan/components/meal-log/meal-log-utils"
import { SECTION_LABELS } from "@/features/meal-plan/lib/dates"
import {
  MEAL_LOG_MAX_DETAILS_LENGTH,
  MEAL_LOG_MAX_NAME_LENGTH,
  type CalorieEstimate,
  type NewMealLogEntry,
} from "@/features/meal-plan/schemas/meal-log.schema"
import { MEAL_SECTIONS, type MealSection } from "@/features/meal-plan/schemas/meal-plan.schema"

export function CalorieReferences({
  note,
  references,
}: {
  note: string | null
  references: CalorieEstimate["references"]
}) {
  if (!note && references.length === 0) return null
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none">Cách ước tính</summary>
      {note && <p className="mt-1">{note}</p>}
      {references.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {references.map((reference) => (
            <li key={reference.url}>
              <a
                href={reference.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-2 hover:underline"
              >
                {reference.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}

export function AddMealLogForm({
  date,
  initialName = "",
  initialDetails = "",
  onCancel,
  onSaved,
}: {
  date: string
  initialName?: string
  initialDetails?: string
  onCancel: () => void
  onSaved: () => Promise<void>
}) {
  const { accessToken } = useAuth()
  const [section, setSection] = useState<MealSection>(sectionForNow)
  const [name, setName] = useState(initialName)
  const [details, setDetails] = useState(initialDetails)
  const [servings, setServings] = useState("1")
  const [calories, setCalories] = useState("")
  const [estimate, setEstimate] = useState<CalorieEstimate | null>(null)
  const [lookup, setLookup] = useState<AbortController | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsedServings = parseServings(servings)
  const parsedCalories = parseCalories(calories)
  const caloriesInvalid = calories.trim() !== "" && parsedCalories === null
  const usesEstimate =
    estimate !== null && estimate.caloriesPerServing !== null && parsedCalories === estimate.caloriesPerServing

  async function lookUp() {
    if (!accessToken || !name.trim()) return
    const controller = new AbortController()
    setLookup(controller)
    setError(null)
    try {
      const found = await estimateCalories(
        accessToken,
        { name: name.trim(), details: details.trim() || undefined },
        controller.signal
      )
      setEstimate(found)
      if (found.caloriesPerServing === null) {
        setError("AI chưa tìm được số đủ tin cậy. Bạn có thể tự nhập kcal.")
      } else {
        setCalories(String(found.caloriesPerServing))
      }
    } catch (caught) {
      if (!controller.signal.aborted) setError(logErrorMessage(caught))
    } finally {
      setLookup(null)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!accessToken || !name.trim() || parsedServings === null || caloriesInvalid) return
    setSaving(true)
    setError(null)
    const entry: NewMealLogEntry = { date, section, name: name.trim(), servings: parsedServings }
    if (parsedCalories !== null && usesEstimate) {
      Object.assign(entry, {
        caloriesPerServing: parsedCalories,
        calorieSource: "WEB_ESTIMATE",
        calorieNote: estimate.note ?? undefined,
        calorieReferences: estimate.references,
      })
    } else if (parsedCalories !== null) {
      Object.assign(entry, { caloriesPerServing: parsedCalories, calorieSource: "USER" })
    }
    try {
      await createMealLogEntry(accessToken, entry)
      await onSaved()
    } catch (caught) {
      setError(logErrorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-border p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Thêm món đã ăn</h4>
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Đóng" onClick={onCancel}>
          <XIcon aria-hidden />
        </Button>
      </div>
      <FieldGroup>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Field>
            <FieldLabel htmlFor="log-name">Tên món</FieldLabel>
            <Input
              id="log-name"
              required
              maxLength={MEAL_LOG_MAX_NAME_LENGTH}
              value={name}
              placeholder="Ví dụ: Bún riêu chay"
              onChange={(event) => {
                setName(event.target.value)
                setEstimate(null)
              }}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="log-section">Bữa</FieldLabel>
            <NativeSelect
              id="log-section"
              value={section}
              onChange={(event) => {
                const next = MEAL_SECTIONS.find((item) => item === event.target.value)
                if (next) setSection(next)
              }}
            >
              {MEAL_SECTIONS.map((item) => (
                <NativeSelectOption key={item} value={item}>
                  {SECTION_LABELS[item]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="log-details">Mô tả thêm (tuỳ chọn)</FieldLabel>
          <Input
            id="log-details"
            maxLength={MEAL_LOG_MAX_DETAILS_LENGTH}
            value={details}
            placeholder="Tô lớn ở quán, thêm đậu hũ chiên…"
            onChange={(event) => setDetails(event.target.value)}
          />
          <FieldDescription>Giúp AI ước tính kcal sát hơn.</FieldDescription>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field>
            <FieldLabel htmlFor="log-servings">Số phần</FieldLabel>
            <Input
              id="log-servings"
              inputMode="decimal"
              value={servings}
              aria-invalid={parsedServings === null}
              onChange={(event) => setServings(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="log-kcal">Kcal mỗi phần</FieldLabel>
            <Input
              id="log-kcal"
              inputMode="numeric"
              value={calories}
              aria-invalid={caloriesInvalid}
              placeholder="Chưa rõ"
              onChange={(event) => setCalories(event.target.value)}
            />
          </Field>
        </div>
      </FieldGroup>

      {lookup ? (
        <div role="status" className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Spinner aria-hidden /> AI đang tìm kcal trên web…
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={() => lookup.abort()}>
            Huỷ
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          disabled={!name.trim()}
          onClick={() => void lookUp()}
        >
          <SearchIcon aria-hidden />
          AI tìm kcal
        </Button>
      )}

      {usesEstimate && estimate && (
        <div className="rounded-lg bg-muted/60 p-2 text-xs">
          <p className="mb-1 font-medium">AI ước tính ~{kcal(estimate.caloriesPerServing ?? 0)} mỗi phần. Bạn sửa nếu cần.</p>
          <CalorieReferences note={estimate.note} references={estimate.references} />
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="sm"
        className="w-full"
        disabled={saving || lookup !== null || !name.trim() || parsedServings === null || caloriesInvalid}
      >
        {saving && <Spinner aria-hidden />}
        Lưu vào nhật ký
      </Button>
    </form>
  )
}
