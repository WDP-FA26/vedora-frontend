"use client"

import { useState, type FormEvent } from "react"
import { CheckIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { useAuth } from "@/features/auth/hooks/use-auth"
import {
  createMealLogEntry,
  deleteMealLogEntry,
  updateMealLogEntry,
} from "@/features/meal-plan/api/meal-log.api"
import { AddMealLogForm, CalorieReferences } from "@/features/meal-plan/components/meal-log/add-meal-log-form"
import {
  kcal,
  logErrorMessage,
  parseCalories,
  parseServings,
  plannedRecipes,
  type CustomDishPrefill,
} from "@/features/meal-plan/components/meal-log/meal-log-utils"
import { DAY_LABELS, SECTION_LABELS } from "@/features/meal-plan/lib/dates"
import { caloriesLabel, servingsLabel } from "@/features/meal-plan/lib/format"
import type { MealLogDay, MealLogEntry } from "@/features/meal-plan/schemas/meal-log.schema"
import { MEAL_SECTIONS, type MealPlan, type MealRecipe, type MealSection } from "@/features/meal-plan/schemas/meal-plan.schema"

function EntryRow({
  entry,
  editable,
  busy,
  onUpdate,
  onDelete,
}: {
  entry: MealLogEntry
  editable: boolean
  busy: boolean
  onUpdate: (change: { servings?: number; caloriesPerServing?: number | null }) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [servings, setServings] = useState(String(entry.servings))
  const [calories, setCalories] = useState(entry.caloriesPerServing === null ? "" : String(entry.caloriesPerServing))
  const parsedServings = parseServings(servings)
  const parsedCalories = parseCalories(calories)
  const caloriesInvalid = calories.trim() !== "" && parsedCalories === null

  function save(event: FormEvent) {
    event.preventDefault()
    if (parsedServings === null || caloriesInvalid) return
    const change: { servings?: number; caloriesPerServing?: number | null } = {}
    if (parsedServings !== entry.servings) change.servings = parsedServings
    if (parsedCalories !== entry.caloriesPerServing) change.caloriesPerServing = parsedCalories
    setEditing(false)
    if (Object.keys(change).length > 0) onUpdate(change)
  }

  if (editing) {
    return (
      <li className="px-3 py-2">
        <form onSubmit={save} className="space-y-2">
          <p className="text-sm font-medium">{entry.name}</p>
          <div className="grid grid-cols-2 gap-2">
            <Field>
              <FieldLabel htmlFor={`servings-${entry.id}`}>Số phần</FieldLabel>
              <Input
                id={`servings-${entry.id}`}
                inputMode="decimal"
                value={servings}
                aria-invalid={parsedServings === null}
                onChange={(event) => setServings(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`kcal-${entry.id}`}>Kcal mỗi phần</FieldLabel>
              <Input
                id={`kcal-${entry.id}`}
                inputMode="numeric"
                value={calories}
                aria-invalid={caloriesInvalid}
                placeholder="Chưa rõ"
                onChange={(event) => setCalories(event.target.value)}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setServings(String(entry.servings))
                setCalories(entry.caloriesPerServing === null ? "" : String(entry.caloriesPerServing))
                setEditing(false)
              }}
            >
              Huỷ
            </Button>
            <Button type="submit" size="sm" disabled={busy || parsedServings === null || caloriesInvalid}>
              Lưu
            </Button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium">
          {entry.name}
          {entry.servings !== 1 && (
            <span className="font-normal text-muted-foreground"> × {servingsLabel(entry.servings)}</span>
          )}
        </p>
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
          {caloriesLabel(entry)}
          {entry.calorieSource === "WEB_ESTIMATE" && <Badge variant="secondary">AI ước tính</Badge>}
          {entry.source === "CUSTOM" && <Badge variant="outline">Ngoài thực đơn</Badge>}
        </p>
        {entry.calorieSource === "WEB_ESTIMATE" && (
          <CalorieReferences note={entry.calorieNote} references={entry.calorieReferences} />
        )}
      </div>
      {editable && (
        <span className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Sửa ${entry.name}`}
            disabled={busy}
            onClick={() => setEditing(true)}
          >
            <PencilIcon aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Xoá ${entry.name}`}
            disabled={busy}
            onClick={onDelete}
          >
            <Trash2Icon aria-hidden />
          </Button>
        </span>
      )}
    </li>
  )
}

function SectionLog({
  section,
  entries,
  planned,
  loggable,
  busy,
  onTick,
  onUpdate,
  onDelete,
}: {
  section: MealSection
  entries: MealLogEntry[]
  planned: MealRecipe[]
  loggable: boolean
  busy: boolean
  onTick: (recipeId: string) => void
  onUpdate: (id: string, change: { servings?: number; caloriesPerServing?: number | null }) => void
  onDelete: (id: string) => void
}) {
  const loggedRecipeIds = new Set(entries.map((entry) => entry.recipeId))
  const notEaten = loggable ? planned.filter((recipe) => !loggedRecipeIds.has(recipe.id)) : []
  if (entries.length === 0 && notEaten.length === 0) return null

  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-semibold text-muted-foreground">{SECTION_LABELS[section]}</h4>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {entries.map((entry) => (
          <EntryRow
            key={`${entry.id}:${entry.servings}:${entry.caloriesPerServing ?? "none"}`}
            entry={entry}
            editable={loggable}
            busy={busy}
            onUpdate={(change) => onUpdate(entry.id, change)}
            onDelete={() => onDelete(entry.id)}
          />
        ))}
        {notEaten.map((recipe) => (
          <li key={recipe.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span className="min-w-0 text-muted-foreground">
              {recipe.title}
              <span className="block text-xs">Trong thực đơn</span>
            </span>
            <Button type="button" variant="outline" size="xs" disabled={busy} onClick={() => onTick(recipe.id)}>
              <CheckIcon aria-hidden />
              Đã ăn
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function MealLogDayView({
  plan,
  day,
  initialPrefill,
  onClearPrefill,
  onChanged,
}: {
  plan: MealPlan
  day: MealLogDay
  initialPrefill?: CustomDishPrefill | null
  onClearPrefill?: () => void
  onChanged: () => Promise<void>
}) {
  const { accessToken } = useAuth()
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(Boolean(initialPrefill))

  async function run(action: (token: string) => Promise<unknown>) {
    if (!accessToken) return
    setBusy(true)
    try {
      await action(accessToken)
      await onChanged()
    } catch (error) {
      toast.add({ title: logErrorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  const unknown = day.unknownCalorieEntries > 0 ? `, ${day.unknownCalorieEntries} món chưa có kcal` : ""
  const planned = day.plannedCalories === null ? "" : ` · Kế hoạch ~${kcal(day.plannedCalories)}`

  return (
    <section aria-label={`Nhật ký ${DAY_LABELS[day.day]}`} className="space-y-3">
      <div>
        <h3 className="font-heading text-base font-bold">{DAY_LABELS[day.day]}</h3>
        <p className="text-xs text-muted-foreground tabular-nums">
          Đã ăn {kcal(day.loggedCalories)}
          {unknown}
          {planned}
        </p>
        {!day.loggable && (
          <p className="text-xs text-muted-foreground">
            Chỉ ghi được hôm nay và 7 ngày trước đó.
          </p>
        )}
      </div>

      {day.loggable && adding && (
        <AddMealLogForm
          date={day.date}
          initialName={initialPrefill?.name}
          initialDetails={initialPrefill?.details}
          onCancel={() => {
            setAdding(false)
            onClearPrefill?.()
          }}
          onSaved={async () => {
            setAdding(false)
            onClearPrefill?.()
            await onChanged()
          }}
        />
      )}

      {MEAL_SECTIONS.map((section) => (
        <SectionLog
          key={section}
          section={section}
          entries={day.entries.filter((entry) => entry.section === section)}
          planned={plannedRecipes(plan, day.day, section)}
          loggable={day.loggable}
          busy={busy}
          onTick={(recipeId) => void run((token) => createMealLogEntry(token, { date: day.date, section, recipeId }))}
          onUpdate={(id, change) => void run((token) => updateMealLogEntry(token, id, change))}
          onDelete={(id) => void run((token) => deleteMealLogEntry(token, id))}
        />
      ))}

      {day.loggable && !adding && (
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setAdding(true)}>
          <PlusIcon aria-hidden />
          Thêm món khác
        </Button>
      )}
    </section>
  )
}
