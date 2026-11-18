"use client"

import { useEffect, useState, type DragEvent, type ReactNode } from "react"
import { z } from "zod"
import {
  ArrowRightLeftIcon,
  BookOpenIcon,
  EllipsisIcon,
  MessageCircleIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react"

import { tagView, type RecipeTag } from "@/features/recipes/tags"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { RecipeSheet, type OpenedDish } from "@/features/meal-plan/components/recipe-sheet"
import {
  DAY_SHORT,
  displayDays,
  type RecipeRef,
} from "@/features/meal-plan/components/timetable"
import {
  DAY_LABELS,
  dayOfMonth,
  dishKey,
  dishWarnings,
  editableDaysOf,
  isDayEditable,
  MAX_DISHES_PER_SECTION,
  MEAL_SECTIONS,
  recipesAt,
  SECTION_LABELS,
  searchRecipeOptions,
  todayOf,
  WEEKDAYS,
  type MealPlan,
  type MealPlanProposal,
  type MealSection,
  type RecipeOption,
  type SlotChange,
  type SlotRef,
  type Weekday,
} from "@/features/meal-plan/meal-plan"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { cn } from "@/lib/utils"

const DRAG_TYPE = "application/x-vedora-meal"
const PAST_DAY_MESSAGE = "Ngày đã qua nên không thể thay đổi."

type Dragged = SlotRef & { recipeId: string }

type CalendarBoardProps = {
  plan: MealPlan | undefined
  failed: boolean
  /**
   * A proposal for this week that the user has not decided on yet, previewed on the
   * grid. It is applied or dismissed from its card in the chat, never from here.
   */
  suggestion?: MealPlanProposal | null
  /** Brings the chat, where the proposal's card is, into view. */
  onOpenChat?: () => void
  /** Applies the new content of one or more meal slots; rejects with a user-facing message. */
  onChange: (changes: SlotChange[]) => Promise<void>
  onAsk?: (recipe: RecipeRef, day: Weekday, section: MealSection) => void
  /** Asks the assistant for dishes for an empty or partly filled slot. */
  onSuggestSlot?: (slot: SlotRef) => void
  onRetry?: () => void
  /** Buttons at the right of the toolbar above the grid. */
  action?: ReactNode
  /** Controls in the top-left corner cell (shown when the assistant is hidden). */
  leading?: ReactNode
}

const draggedSchema = z.object({
  day: z.enum(WEEKDAYS),
  section: z.enum(MEAL_SECTIONS),
  recipeId: z.string(),
})

function parseDragged(event: DragEvent): Dragged | null {
  const raw = event.dataTransfer.getData(DRAG_TYPE)
  if (!raw) return null
  try {
    const parsed = draggedSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

function slotLabel({ day, section }: SlotRef) {
  return `${DAY_LABELS[day]}, bữa ${SECTION_LABELS[section].toLowerCase()}`
}

/** A week-at-a-glance grid: one column per weekday, one row per meal. */
export function CalendarBoard({
  plan,
  failed,
  suggestion = null,
  onOpenChat,
  onChange,
  onAsk,
  onSuggestSlot,
  onRetry,
  action,
  leading,
}: CalendarBoardProps) {
  // Today, the dates and which days may change all come from the server's answer.
  const today = plan ? todayOf(plan) : undefined
  const weekDates = plan ? plan.days.map(({ date }) => dayOfMonth(date)) : []
  const [pickedDay, setPickedDay] = useState<Weekday | null>(null)
  const selectedDay: Weekday = pickedDay ?? today ?? (plan ? editableDaysOf(plan)[0] : undefined) ?? "MON"
  const setSelectedDay = setPickedDay
  const [opened, setOpened] = useState<OpenedDish | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [adding, setAdding] = useState<SlotRef | null>(null)
  const [moving, setMoving] = useState<(Dragged & { title: string }) | null>(null)
  const [dropTarget, setDropTarget] = useState<SlotRef | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** A day before today can only be read. */
  const dayEditable = (day: Weekday) => (plan ? isDayEditable(plan, day) : false)

  const overlay = suggestion
  const locked = overlay !== null
  const view = displayDays(plan, overlay)
  const warnings = plan && !locked ? dishWarnings(plan.problems) : new Map<string, string[]>()

  /** Dishes the proposal drops from a slot, shown struck through. */
  function removedAt({ day, section }: SlotRef): RecipeRef[] {
    if (!overlay) return []
    const proposed = overlay.days.find((item) => item.day === day)
      ?.sections.find((item) => item.section === section)
    if (!proposed) return []
    const kept = new Set(proposed.recipes.map(({ id }) => id))
    return proposed.previous.filter(({ id }) => !kept.has(id))
  }

  async function apply(changes: SlotChange[]) {
    setSaving(true)
    setError(null)
    try {
      await onChange(changes)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không lưu được thay đổi.")
    } finally {
      setSaving(false)
    }
  }

  function idsAt(slot: SlotRef) {
    if (!plan) return []
    return recipesAt(plan, slot).map(({ id }) => id)
  }

  function planMove(from: Dragged, to: SlotRef): SlotChange[] | string {
    if (from.day === to.day && from.section === to.section) return []
    if (!dayEditable(from.day) || !dayEditable(to.day)) return PAST_DAY_MESSAGE
    const targetIds = idsAt(to)
    if (targetIds.includes(from.recipeId)) return "Món này đã có trong bữa đó."
    if (targetIds.length >= MAX_DISHES_PER_SECTION) {
      return `Mỗi bữa tối đa ${MAX_DISHES_PER_SECTION} món.`
    }
    return [
      { day: from.day, section: from.section, recipeIds: idsAt(from).filter((id) => id !== from.recipeId) },
      { ...to, recipeIds: [...targetIds, from.recipeId] },
    ]
  }

  function move(from: Dragged, to: SlotRef) {
    const changes = planMove(from, to)
    if (typeof changes === "string") {
      setError(changes)
      return
    }
    if (changes.length > 0) void apply(changes)
  }

  function remove(from: Dragged) {
    if (!dayEditable(from.day)) {
      setError(PAST_DAY_MESSAGE)
      return
    }
    void apply([{ day: from.day, section: from.section, recipeIds: idsAt(from).filter((id) => id !== from.recipeId) }])
  }

  function add(slot: SlotRef, recipeId: string) {
    if (!dayEditable(slot.day)) {
      setError(PAST_DAY_MESSAGE)
      return
    }
    const ids = idsAt(slot)
    if (ids.includes(recipeId)) {
      setError("Món này đã có trong bữa đó.")
      return
    }
    void apply([{ ...slot, recipeIds: [...ids, recipeId] }])
  }

  function handleDrop(event: DragEvent, to: SlotRef) {
    event.preventDefault()
    setDropTarget(null)
    if (locked || saving) return
    const from = parseDragged(event)
    if (from) move(from, to)
  }

  if (!plan) {
    if (failed) {
      return (
        <div className="p-4 sm:p-5">
          <Alert variant="destructive">
            <TriangleAlertIcon aria-hidden />
            <AlertTitle>Không tải được thực đơn</AlertTitle>
            <AlertDescription>
              Thử lại để xem lịch của bạn.
              {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Thử lại</Button>}
            </AlertDescription>
          </Alert>
        </div>
      )
    }
    return (
      <div className="flex min-h-56 flex-col items-center justify-center gap-3 p-6 text-center">
        <Spinner aria-label="Đang tải thực đơn" />
        <p className="text-sm text-muted-foreground">Đang tải thực đơn của bạn…</p>
      </div>
    )
  }

  return (
    <div className="relative flex h-[calc(100dvh-4.5rem)] min-h-[24rem] min-w-0 flex-col bg-card pb-[env(safe-area-inset-bottom)] lg:h-full lg:min-h-0 lg:pb-0">
      {action && (
        <div className="flex h-16 shrink-0 items-center justify-end gap-2 border-b border-border px-3">{action}</div>
      )}
      {saving && (
        <span
          role="status"
          className="absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs shadow-sm"
        >
          <Spinner aria-hidden /> Đang lưu…
        </span>
      )}

      {suggestion && (
        <div className="px-4 pt-4 sm:px-5">
          <Alert>
            <SparklesIcon aria-hidden />
            <AlertTitle>Trợ lý đề xuất thay đổi</AlertTitle>
            <AlertDescription>
              Các món có viền nét đứt là món mới, món bị gạch sẽ được thay. Chưa có gì được lưu: bấm “Áp dụng” hoặc
              “Bỏ đề xuất” trên thẻ đề xuất trong khung trợ lý.
              {onOpenChat && (
                <span className="mt-2 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={onOpenChat}>
                    <MessageCircleIcon aria-hidden /> Xem thẻ đề xuất
                  </Button>
                </span>
              )}
            </AlertDescription>
          </Alert>
        </div>
      )}
      {error && (
        <div className="px-4 pt-4 sm:px-5">
          <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        </div>
      )}
      <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-24 md:hidden">
        <div
          className="sticky top-0 z-10 grid grid-cols-7 border-b border-border bg-card/95 px-2 py-2.5 backdrop-blur-sm"
          role="group"
          aria-label="Chọn ngày trong thực đơn"
        >
          {WEEKDAYS.map((day, index) => {
            const selected = selectedDay === day
            const dayHasDishes =
              view
                .find((item) => item.day === day)
                ?.sections.some(({ recipes }) => recipes.length > 0) ?? false
            const dayHasWarning = Boolean(
              plan &&
                !locked &&
                plan.problems.some((problem) => problem.day === day)
            )
            return (
              <button
                key={day}
                type="button"
                aria-pressed={selected}
                aria-label={
                  DAY_LABELS[day] +
                  (day === today ? ", hôm nay" : "") +
                  (dayHasWarning ? ", có món cần xem lại" : "")
                }
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "relative flex flex-col items-center gap-1 rounded-xl py-1.5 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/30",
                  selected ? "bg-primary/10" : "hover:bg-accent/60",
                  !dayEditable(day) && !selected && "opacity-60"
                )}
              >
                <span
                  className={cn(
                    "text-[0.6875rem] font-semibold",
                    selected || day === today ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {DAY_SHORT[day]}
                </span>
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                    selected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : day === today
                        ? "text-primary ring-1 ring-primary/40"
                        : "text-foreground"
                  )}
                >
                  {weekDates[index]}
                </span>
                <span className="flex h-1.5 items-center gap-1" aria-hidden>
                  {dayHasDishes && !dayHasWarning && (
                    <span className="size-1.5 rounded-full bg-primary/60" />
                  )}
                  {dayHasWarning && (
                    <span className="size-1.5 rounded-full bg-destructive" />
                  )}
                </span>
              </button>
            )
          })}
        </div>

        <section
          aria-label={`Thực đơn ${DAY_LABELS[selectedDay]}`}
          className="flex flex-col gap-3 p-3 sm:p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-heading text-base font-bold">
              {DAY_LABELS[selectedDay]}
              {selectedDay === today && (
                <span className="ml-2 text-xs font-medium text-primary">Hôm nay</span>
              )}
              {!dayEditable(selectedDay) && (
                <span className="ml-2 text-xs font-medium text-muted-foreground">Đã qua, chỉ xem</span>
              )}
            </h3>
          </div>
          {MEAL_SECTIONS.map((section) => {
            const slot = { day: selectedDay, section }
            const recipes =
              view
                .find((item) => item.day === selectedDay)
                ?.sections.find((item) => item.section === section)?.recipes ?? []
            const removed = removedAt(slot)
            return (
              <article
                key={section}
                aria-label={slotLabel(slot)}
                className="flex flex-col gap-2.5 rounded-2xl border border-border bg-background p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground">
                    Bữa {SECTION_LABELS[section].toLowerCase()}
                  </h4>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {recipes.length} món
                  </span>
                </div>
                {recipes.length === 0 && removed.length === 0 && (
                  <p className="text-xs text-muted-foreground">Chưa có món cho bữa này.</p>
                )}
                {recipes.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {recipes.map((recipe) => {
                      const detail = recipe.detail
                      const isNew = overlay !== null && !idsAt(slot).includes(recipe.id)
                      return (
                        <CalendarChip
                          key={recipe.id}
                          title={recipe.title}
                          tag={detail?.tag ?? recipe.tag}
                          slot={slot}
                          recipeId={recipe.id}
                          warnings={warnings.get(dishKey(selectedDay, recipe.id)) ?? []}
                          isNew={isNew}
                          disabled={locked || saving || !dayEditable(selectedDay)}
                          onOpen={() => {
                            setOpened({
                              recipeId: recipe.id,
                              title: recipe.title,
                              day: selectedDay,
                              section,
                              detail,
                            })
                            setSheetOpen(true)
                          }}
                          onMove={() =>
                            setMoving({
                              day: selectedDay,
                              section,
                              recipeId: recipe.id,
                              title: recipe.title,
                            })
                          }
                          onRemove={() => remove({ day: selectedDay, section, recipeId: recipe.id })}
                          onAsk={onAsk ? () => onAsk(recipe, selectedDay, section) : undefined}
                        />
                      )
                    })}
                  </div>
                )}
                {removed.map((recipe) => (
                  <p
                    key={recipe.id}
                    className="rounded-xl border border-dashed border-border px-2.5 py-1.5 text-xs text-muted-foreground line-through"
                  >
                    {recipe.title}
                  </p>
                ))}
                {!locked && dayEditable(selectedDay) && (
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    {recipes.length < MAX_DISHES_PER_SECTION && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={() => setAdding(slot)}
                        aria-label={`Thêm món vào ${slotLabel(slot)}`}
                      >
                        <PlusIcon aria-hidden /> Thêm món
                      </Button>
                    )}
                    {onSuggestSlot && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={saving}
                        onClick={() => onSuggestSlot(slot)}
                        aria-label={`Nhờ trợ lý gợi ý món cho ${slotLabel(slot)}`}
                      >
                        <SparklesIcon aria-hidden /> Gợi ý món
                      </Button>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </section>
      </div>

      <div className="hidden min-h-0 flex-1 overflow-auto md:block [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div
          role="table"
          aria-label="Lịch thực đơn tuần"
          className="grid min-h-[34rem] min-w-0 grid-cols-[3rem_repeat(7,minmax(0,1fr))] grid-rows-[auto_repeat(4,minmax(6.5rem,1fr))] gap-px bg-border lg:min-h-full lg:min-w-[52rem] xl:min-w-0"
        >
          <div role="row" className="contents">
            <div role="columnheader" className="sticky top-0 left-0 z-20 flex flex-col items-center justify-center gap-1 bg-card shadow-[1px_1px_0_0_var(--border)]">{leading}</div>
            {WEEKDAYS.map((day, index) => (
              <div
                key={day}
                role="columnheader"
                aria-label={DAY_LABELS[day] + (day === today ? ", hôm nay" : "")}
                className="sticky top-0 z-10 flex h-[calc(4rem-1px)] flex-col items-center justify-center gap-0.5 bg-card shadow-[0_1px_0_0_var(--border)]"
              >
                <span className={cn("text-[0.6875rem] font-semibold", day === today ? "text-primary" : "text-muted-foreground")}>
                  {DAY_SHORT[day]}
                </span>
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                    day === today ? "bg-primary text-primary-foreground" : "text-foreground"
                  )}
                >
                  {weekDates[index]}
                </span>
              </div>
            ))}
          </div>

          {MEAL_SECTIONS.map((section) => (
            <div key={section} role="row" className="contents">
              <div role="rowheader" className="sticky left-0 z-10 flex items-start justify-center bg-card px-1 pt-3 text-[0.6875rem] font-semibold text-muted-foreground shadow-[1px_0_0_0_var(--border)]">
                {SECTION_LABELS[section]}
              </div>
              {WEEKDAYS.map((day) => {
                const slot = { day, section }
                const recipes = view.find((item) => item.day === day)
                  ?.sections.find((item) => item.section === section)?.recipes ?? []
                const targeted = dropTarget?.day === day && dropTarget.section === section
                return (
                  <div
                    key={day}
                    role="cell"
                    aria-label={slotLabel(slot)}
                    onDragOver={(event) => {
                      if (locked || saving || !dayEditable(day)) return
                      event.preventDefault()
                      setDropTarget(slot)
                    }}
                    onDragLeave={() => setDropTarget((current) => (current?.day === day && current.section === section ? null : current))}
                    onDrop={(event) => handleDrop(event, slot)}
                    className={cn(
                      "flex min-h-24 flex-col gap-1.5 bg-card p-1.5 transition-colors",
                      day === today && "bg-secondary/30",
                      !dayEditable(day) && "bg-muted/50",
                      targeted && "bg-primary/10 ring-2 ring-inset ring-primary/40"
                    )}
                  >
                    {recipes.map((recipe) => {
                      const detail = recipe.detail
                      const isNew = overlay !== null && !idsAt(slot).includes(recipe.id)
                      return (
                        <CalendarChip
                          key={recipe.id}
                          title={recipe.title}
                          tag={detail?.tag ?? recipe.tag}
                          slot={slot}
                          recipeId={recipe.id}
                          warnings={warnings.get(dishKey(day, recipe.id)) ?? []}
                          isNew={isNew}
                          disabled={locked || saving || !dayEditable(day)}
                          onOpen={() => {
                            setOpened({ recipeId: recipe.id, title: recipe.title, day, section, detail })
                            setSheetOpen(true)
                          }}
                          onMove={() => setMoving({ day, section, recipeId: recipe.id, title: recipe.title })}
                          onRemove={() => remove({ day, section, recipeId: recipe.id })}
                          onAsk={onAsk ? () => onAsk(recipe, day, section) : undefined}
                        />
                      )
                    })}
                    {removedAt(slot).map((recipe) => (
                      <p
                        key={recipe.id}
                        className="rounded-xl border border-dashed border-border px-2 py-1 text-xs text-muted-foreground line-through"
                      >
                        {recipe.title}
                      </p>
                    ))}
                    {!locked && dayEditable(day) && (
                      <div className="mt-auto flex items-center gap-0.5">
                        {recipes.length < MAX_DISHES_PER_SECTION && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={saving}
                            onClick={() => setAdding(slot)}
                            aria-label={`Thêm món vào ${slotLabel(slot)}`}
                          >
                            <PlusIcon aria-hidden />
                          </Button>
                        )}
                        {onSuggestSlot && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="ml-auto"
                            disabled={saving}
                            onClick={() => onSuggestSlot(slot)}
                            aria-label={`Nhờ trợ lý gợi ý món cho ${slotLabel(slot)}`}
                          >
                            <SparklesIcon aria-hidden />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <RecipeSheet
        open={sheetOpen}
        dish={opened}
        onClose={() => setSheetOpen(false)}
        onAsk={opened && onAsk ? () => {
          onAsk({ id: opened.recipeId, title: opened.title, tag: opened.detail?.tag ?? null }, opened.day, opened.section)
          setSheetOpen(false)
        } : undefined}
        onMove={opened && !locked && dayEditable(opened.day) ? () => {
          setMoving({ day: opened.day, section: opened.section, recipeId: opened.recipeId, title: opened.title })
          setSheetOpen(false)
        } : undefined}
        onRemove={opened && !locked && dayEditable(opened.day) ? () => {
          remove({ day: opened.day, section: opened.section, recipeId: opened.recipeId })
          setSheetOpen(false)
        } : undefined}
      />

      <AddRecipeDialog
        slot={adding}
        onClose={() => setAdding(null)}
        onPick={(recipeId) => {
          if (adding) add(adding, recipeId)
          setAdding(null)
        }}
      />

      <MoveDialog
        moving={moving}
        days={plan ? editableDaysOf(plan) : []}
        onClose={() => setMoving(null)}
        onMove={(to) => {
          if (moving) move(moving, to)
          setMoving(null)
        }}
      />
    </div>
  )
}

function CalendarChip({
  title,
  tag,
  slot,
  recipeId,
  warnings,
  isNew,
  disabled,
  onOpen,
  onMove,
  onRemove,
  onAsk,
}: {
  title: string
  tag: RecipeTag | null
  slot: SlotRef
  recipeId: string
  warnings: string[]
  isNew: boolean
  disabled: boolean
  onOpen: () => void
  onMove: () => void
  onRemove: () => void
  onAsk?: () => void
}) {
  const { icon: TagIcon, label: tagLabel } = tagView(tag)
  const warning = warnings.join("; ")
  return (
    <div
      draggable={!disabled}
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ ...slot, recipeId }))
        event.dataTransfer.effectAllowed = "move"
      }}
      className={cn(
        "group flex min-w-0 items-center gap-0.5 rounded-lg border py-0.5 pr-0.5 pl-1.5 text-xs",
        isNew ? "border-dashed border-primary bg-primary/20" : "border-transparent bg-primary/10",
        !disabled && "cursor-grab active:cursor-grabbing"
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Xem công thức ${title}, ${slotLabel(slot)}`}
        title={warning ? `${title}: ${warning}` : `${title} · ${tagLabel}`}
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-0.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        <TagIcon aria-hidden className="size-3.5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 line-clamp-2 break-words leading-tight font-medium text-foreground">{title}</span>
        {warning && (
          <>
            <TriangleAlertIcon aria-hidden className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="sr-only">Cần xem lại: {warning}</span>
          </>
        )}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button type="button" variant="ghost" size="icon-xs" aria-label={`Tùy chọn cho ${title}, ${slotLabel(slot)}`} />}
        >
          <EllipsisIcon aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onOpen}><BookOpenIcon aria-hidden /> Xem công thức</DropdownMenuItem>
          {onAsk && (
            <DropdownMenuItem onClick={onAsk}><MessageCircleIcon aria-hidden /> Hỏi trợ lý</DropdownMenuItem>
          )}
          {!disabled && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onMove}><ArrowRightLeftIcon aria-hidden /> Chuyển sang…</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={onRemove}><Trash2Icon aria-hidden /> Xóa khỏi bữa</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

const SEARCH_DEBOUNCE_MS = 250

function AddRecipeDialog({
  slot,
  onClose,
  onPick,
}: {
  slot: SlotRef | null
  onClose: () => void
  onPick: (recipeId: string) => void
}) {
  const { accessToken } = useAuth()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<RecipeOption[]>([])
  const [searching, setSearching] = useState(false)
  const [failed, setFailed] = useState(false)
  const open = slot !== null

  // Searches as the user types; an older answer never overwrites a newer one.
  useEffect(() => {
    if (!open || !accessToken) return
    let stale = false
    const delay = query === "" ? 0 : SEARCH_DEBOUNCE_MS
    const timer = setTimeout(async () => {
      setSearching(true)
      setFailed(false)
      try {
        const page = await searchRecipeOptions(accessToken, query)
        if (!stale) setResults(page.items)
      } catch {
        if (!stale) setFailed(true)
      } finally {
        if (!stale) setSearching(false)
      }
    }, delay)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [open, accessToken, query])

  function close() {
    setQuery("")
    setResults([])
    setFailed(false)
    onClose()
  }

  function emptyText() {
    if (failed) return "Không tìm được công thức. Hãy thử lại."
    if (searching) return "Đang tìm…"
    return "Không có món phù hợp."
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-h-[85dvh]">
        <DialogHeader>
          <DialogTitle>Thêm món</DialogTitle>
          <DialogDescription>{slot ? slotLabel(slot) : ""}. Chỉ hiện món phù hợp với hồ sơ ăn uống của bạn.</DialogDescription>
        </DialogHeader>
        <Combobox
          items={results}
          value={null}
          inputValue={query}
          onInputValueChange={setQuery}
          onValueChange={(recipe: RecipeOption | null) => {
            if (!recipe) return
            onPick(recipe.id)
            close()
          }}
          itemToStringLabel={(recipe: RecipeOption) => recipe.title}
          isItemEqualToValue={(a: RecipeOption, b: RecipeOption) => a.id === b.id}
          filter={null}
        >
          <ComboboxInput
            maxLength={100}
            placeholder="Gõ tên món hoặc nguyên liệu, ví dụ: đậu hũ"
            aria-label="Tìm công thức"
            showTrigger={false}
          />
          <ComboboxContent>
            <ComboboxEmpty>{emptyText()}</ComboboxEmpty>
            <ComboboxList>
              {(recipe: RecipeOption) => (
                <ComboboxItem key={recipe.id} value={recipe}>
                  <span className="min-w-0 flex-1 truncate font-medium">{recipe.title}</span>
                  {recipe.totalMinutes !== null && (
                    <span className="shrink-0 text-xs text-muted-foreground">{recipe.totalMinutes} phút</span>
                  )}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </DialogContent>
    </Dialog>
  )
}

function MoveDialog({
  moving,
  days,
  onClose,
  onMove,
}: {
  moving: (Dragged & { title: string }) | null
  /** Days that may still change: a dish cannot be moved onto a day that has passed. */
  days: Weekday[]
  onClose: () => void
  onMove: (to: SlotRef) => void
}) {
  const [day, setDay] = useState<Weekday | null>(null)
  const [section, setSection] = useState<MealSection | null>(null)
  const targetDay = day ?? (moving && days.includes(moving.day) ? moving.day : days[0]) ?? "MON"
  const targetSection = section ?? moving?.section ?? "LUNCH"

  function close() {
    setDay(null)
    setSection(null)
    onClose()
  }

  return (
    <Dialog open={moving !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chuyển món</DialogTitle>
          <DialogDescription>{moving?.title}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold">
            Ngày
            <NativeSelect className="mt-1.5 w-full" value={targetDay} onChange={(event) => setDay(WEEKDAYS.find((item) => item === event.target.value) ?? null)}>
              {days.map((item) => <NativeSelectOption key={item} value={item}>{DAY_LABELS[item]}</NativeSelectOption>)}
            </NativeSelect>
          </label>
          <label className="text-xs font-semibold">
            Bữa
            <NativeSelect className="mt-1.5 w-full" value={targetSection} onChange={(event) => setSection(MEAL_SECTIONS.find((item) => item === event.target.value) ?? null)}>
              {MEAL_SECTIONS.map((item) => <NativeSelectOption key={item} value={item}>{SECTION_LABELS[item]}</NativeSelectOption>)}
            </NativeSelect>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>Hủy</Button>
          <Button
            onClick={() => {
              onMove({ day: targetDay, section: targetSection })
              close()
            }}
          >
            Chuyển
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
