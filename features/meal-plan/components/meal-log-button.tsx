"use client"

import { useImperativeHandle, useRef, useState, type FormEvent, type Ref } from "react"
import { useRouter } from "next/navigation"
import {
  CheckIcon,
  NotebookPenIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import {
  caloriesLabel,
  createMealLogEntry,
  deleteMealLogEntry,
  estimateCalories,
  fetchMealLog,
  mealLogKey,
  MEAL_LOG_MAX_CALORIES,
  MEAL_LOG_MAX_DETAILS_LENGTH,
  MEAL_LOG_MAX_NAME_LENGTH,
  MEAL_LOG_MAX_SERVINGS,
  MEAL_LOG_MIN_SERVINGS,
  servingsLabel,
  updateMealLogEntry,
  type CalorieEstimate,
  type MealLogDay,
  type MealLogEntry,
  type MealLogWeek,
  type NewMealLogEntry,
} from "@/features/meal-plan/meal-log"
import {
  DAY_LABELS,
  formatDayMonth,
  MEAL_SECTIONS,
  SECTION_LABELS,
  type MealPlan,
  type MealRecipe,
  type MealSection,
  type Weekday,
} from "@/features/meal-plan/meal-plan"
import {
  readScrollState,
  scrollContainer,
  type ScreenScrollDirection,
  type VoiceScrollState,
} from "@/features/meal-plan/voice"
import { ApiError } from "@/features/shared/lib/api-client"
import { cn } from "@/lib/utils"

const SHORT_DAY_LABELS: Record<Weekday, string> = {
  MON: "T2",
  TUE: "T3",
  WED: "T4",
  THU: "T5",
  FRI: "T6",
  SAT: "T7",
  SUN: "CN",
}

function dayLabel(day: MealLogDay) {
  return `${SHORT_DAY_LABELS[day.day]} ${formatDayMonth(day.date)}`
}

/**
 * Asks for a review first and names the days that may change: from today to
 * Sunday of the logged week, never another week.
 */
function reviewPrompt(week: MealLogWeek) {
  const today = week.days.find((item) => item.date === week.today)
  const sunday = week.days[week.days.length - 1]
  if (!today || !sunday) return null
  const range =
    today.date === sunday.date
      ? `chỉ hôm nay (${dayLabel(today)})`
      : `chỉ từ hôm nay (${dayLabel(today)}) đến ${dayLabel(sunday)}`
  return `Xem nhật ký ăn uống tuần này và nhận xét ngắn so với kế hoạch và mục tiêu của mình. Nếu nên chỉnh thực đơn thì hỏi mình trước; khi chỉnh, ${range}, không đụng tuần khác.`
}

function kcal(value: number) {
  return `${value.toLocaleString("vi-VN")} kcal`
}

/** What went wrong, in words the user can act on. */
function logErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return "Không lưu được. Hãy thử lại."
  if (error.code === "MEAL_LOG_LOCKED") return "Chỉ ghi được hôm nay và 7 ngày trước đó."
  if (error.code === "MEAL_LOG_FULL") return "Bữa này đã đủ số món tối đa."
  if (error.code === "CONFLICT") return "Món này đã có trong bữa đó; hãy sửa số phần ăn."
  if (error.code === "AI_QUOTA_EXCEEDED") return "Bạn đã dùng hết lượt AI. Hãy tự nhập kcal."
  if (error.status === 429) return "Bạn thao tác hơi nhanh, đợi một chút rồi thử lại."
  if (error.status === 503) return "AI đang bận, chưa tìm được kcal. Bạn có thể tự nhập."
  return error.message
}

/** The meal of the current hour, as the default for a new dish. */
function sectionForNow(): MealSection {
  const hour = new Date().getHours()
  if (hour < 10) return "BREAKFAST"
  if (hour < 15) return "LUNCH"
  if (hour < 21) return "DINNER"
  return "OTHER"
}

/** Integer kcal 0–5000 from a text field; null when blank or invalid. */
function parseCalories(text: string): number | null {
  if (!text.trim()) return null
  const value = Number(text)
  if (!Number.isInteger(value) || value < 0 || value > MEAL_LOG_MAX_CALORIES) return null
  return value
}

function parseServings(text: string): number | null {
  const value = Number(text.replace(",", "."))
  if (!Number.isFinite(value)) return null
  if (value < MEAL_LOG_MIN_SERVINGS || value > MEAL_LOG_MAX_SERVINGS) return null
  return Math.round(value * 100) / 100
}

function plannedRecipes(plan: MealPlan, day: Weekday, section: MealSection): MealRecipe[] {
  const planDay = plan.days.find((item) => item.day === day)
  return planDay?.sections.find((item) => item.section === section)?.recipes ?? []
}

export type CustomDishPrefill = {
  name: string
  details?: string
  date?: string
}

/** `openDay(null)` opens the diary on today. */
export type MealLogHandle = {
  openDay: (date: string | null) => void
  openCustomDish: (prefill?: CustomDishPrefill) => void
  close: () => void
  scroll: (direction: ScreenScrollDirection) => void
  /** Whether the diary is open and on which day, for the voice agent's view of the page. */
  screen: () => { open: boolean; date: string | null; scrollState?: VoiceScrollState }
}

/**
 * Header button of the week: what the user actually ate, beside the plan.
 * Ticking a planned dish, adding anything else (kcal typed or looked up by AI)
 * and the week's numbers, in a side sheet.
 */
export function MealLogButton({
  plan,
  onAskAssistant,
  handle,
}: {
  plan: MealPlan
  onAskAssistant?: (prompt: string) => void
  /** Lets the voice agent open and close the diary. */
  handle?: Ref<MealLogHandle>
}) {
  const [open, setOpen] = useState(false)
  const [pickedDay, setPickedDay] = useState<Weekday | null>(null)
  const [prefill, setPrefill] = useState<(CustomDishPrefill & { id: number }) | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const todayDay = plan.days.find((item) => item.date === plan.today)?.day
  const selectedDay: Weekday = pickedDay ?? todayDay ?? "SUN"

  useImperativeHandle(handle, () => ({
    openDay(date) {
      setPickedDay(plan.days.find((item) => item.date === date)?.day ?? null)
      setPrefill(null)
      setOpen(true)
    },
    openCustomDish(next) {
      if (next?.date) {
        setPickedDay(plan.days.find((item) => item.date === next.date)?.day ?? null)
      } else {
        setPickedDay(todayDay ?? null)
      }
      setPrefill({ name: next?.name ?? "", details: next?.details, date: next?.date, id: Date.now() })
      setOpen(true)
    },
    close() {
      setOpen(false)
    },
    scroll(direction) {
      requestAnimationFrame(() => scrollContainer(scrollRef.current, direction))
    },
    screen() {
      const date = plan.days.find((item) => item.day === selectedDay)?.date ?? null
      return {
        open,
        date,
        scrollState: open ? readScrollState(scrollRef.current) : undefined,
      }
    },
  }))
  const router = useRouter()
  const log = useAuthedSWR(open ? mealLogKey(plan.weekStart) : null, fetchMealLog, {
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) router.refresh()
    },
  })
  const day = log.data?.days.find((item) => item.day === selectedDay)

  function reviewWeek(week: MealLogWeek) {
    const prompt = reviewPrompt(week)
    if (!prompt) return
    setOpen(false)
    onAskAssistant?.(prompt)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="sm" />}>
        <NotebookPenIcon aria-hidden />
        Nhật ký
      </SheetTrigger>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Nhật ký ăn uống</SheetTitle>
          <SheetDescription>
            Ghi lại món bạn đã thực sự ăn, kể cả món ngoài thực đơn. Kcal chỉ để tham khảo.
          </SheetDescription>
        </SheetHeader>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-6">
          {log.isLoading && !log.data && (
            <div role="status" aria-label="Đang tải nhật ký" className="space-y-2">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          )}
          {log.error && !log.data && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span>Không tải được nhật ký.</span>
              <Button type="button" variant="outline" size="sm" onClick={() => void log.mutate()}>
                <RotateCcwIcon aria-hidden />
                Thử lại
              </Button>
            </div>
          )}
          {log.data && (
            <>
              <WeekSummary
                week={log.data}
                selectedDay={selectedDay}
                onPickDay={setPickedDay}
                onReview={onAskAssistant ? reviewWeek : undefined}
              />
              {day && (
                <DayLog
                  key={`${day.date}-${prefill?.id ?? 0}`}
                  plan={plan}
                  day={day}
                  initialPrefill={prefill}
                  onClearPrefill={() => setPrefill(null)}
                  onChanged={async () => {
                    await log.mutate()
                  }}
                />
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function WeekSummary({
  week,
  selectedDay,
  onPickDay,
  onReview,
}: {
  week: MealLogWeek
  selectedDay: Weekday
  onPickDay: (day: Weekday) => void
  /** Missing when there is no assistant to ask. */
  onReview?: (week: MealLogWeek) => void
}) {
  const { summary, dailyCalorieTarget } = week
  // A review needs one finished day with every dish counted, and a day left to change.
  const canReview = onReview !== undefined && summary.completeDays > 0 && summary.remainingDays > 0
  let scale = dailyCalorieTarget ?? 0
  for (const item of week.days) {
    scale = Math.max(scale, item.loggedCalories, item.plannedCalories ?? 0)
  }

  return (
    <section aria-label="Tổng quan tuần" className="space-y-3 rounded-xl border border-border p-3">
      <div className="space-y-1 text-sm">
        {summary.averageCalories === null ? (
          <p className="text-muted-foreground">
            Chưa có ngày nào ghi đủ kcal để tính trung bình.
          </p>
        ) : (
          <p>
            Trung bình <span className="font-semibold tabular-nums">~{kcal(summary.averageCalories)}</span>
            /ngày, tính trên {summary.completeDays} ngày đã ghi đủ.
          </p>
        )}
        {dailyCalorieTarget !== null && (
          <p className="text-xs text-muted-foreground">
            Mục tiêu tham khảo ~{kcal(dailyCalorieTarget)}/ngày.
          </p>
        )}
      </div>

      <ToggleGroup
        variant="outline"
        size="sm"
        spacing={1}
        aria-label="Chọn ngày"
        value={[selectedDay]}
        onValueChange={(next: string[]) => {
          const picked = week.days.find((item) => next.includes(item.day))
          if (picked) onPickDay(picked.day)
        }}
        className="grid w-full grid-cols-7"
      >
        {week.days.map((item) => (
          <ToggleGroupItem
            key={item.day}
            value={item.day}
            aria-label={dayAriaLabel(item, week.today)}
            className="h-auto"
          >
            <span className="flex flex-col items-center gap-1 py-1.5">
              <span className={cn("text-xs", item.date === week.today && "font-semibold text-primary")}>
                {SHORT_DAY_LABELS[item.day]}
              </span>
              <DayBar day={item} scale={scale} />
            </span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {canReview && (
        <Button type="button" variant="secondary" size="sm" className="w-full" onClick={() => onReview?.(week)}>
          <SparklesIcon aria-hidden />
          Nhờ trợ lý xem lại tuần
        </Button>
      )}
    </section>
  )
}

function dayAriaLabel(day: MealLogDay, today: string) {
  const parts = [DAY_LABELS[day.day]]
  if (day.date === today) parts.push("hôm nay")
  if (day.entries.length > 0) parts.push(`đã ghi ${kcal(day.loggedCalories)}`)
  return parts.join(", ")
}

/** A quiet bar of what was eaten; no colours for over or under. */
function DayBar({ day, scale }: { day: MealLogDay; scale: number }) {
  const height = scale > 0 ? Math.round((day.loggedCalories / scale) * 100) : 0
  return (
    <span aria-hidden className="flex h-8 w-2 items-end overflow-hidden rounded-full bg-muted">
      <span
        className={cn("w-full rounded-full bg-primary/50", !day.loggable && "bg-muted-foreground/30")}
        style={{ height: `${height}%` }}
      />
    </span>
  )
}

function DayLog({
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
        <AddDishForm
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
        {entry.calorieSource === "WEB_ESTIMATE" && <References note={entry.calorieNote} references={entry.calorieReferences} />}
      </div>
      {editable && (
        <span className="flex shrink-0 gap-1">
          <Button type="button" variant="ghost" size="icon-xs" aria-label={`Sửa ${entry.name}`} disabled={busy} onClick={() => setEditing(true)}>
            <PencilIcon aria-hidden />
          </Button>
          <Button type="button" variant="ghost" size="icon-xs" aria-label={`Xoá ${entry.name}`} disabled={busy} onClick={onDelete}>
            <Trash2Icon aria-hidden />
          </Button>
        </span>
      )}
    </li>
  )
}

function References({
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

function AddDishForm({
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
  // The estimate counts as AI only while the user keeps its number.
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
          <References note={estimate.note} references={estimate.references} />
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
