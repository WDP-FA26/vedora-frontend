"use client"

import { useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  CalendarDaysIcon,
  CheckIcon,
  MessageCircleIcon,
  RefreshCwIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { DIETARY_PATH } from "@/features/dietary/dietary"
import { MealArt } from "@/features/meal-plan/components/meal-art"
import {
  DAY_LABELS,
  problemText,
  SECTION_LABELS,
  WEEKDAYS,
  type MealPlan,
  type MealPlanProposal,
  type MealRecipe,
  type MealSection,
  type Weekday,
} from "@/features/meal-plan/meal-plan"
import { cn } from "@/lib/utils"

type RecipeRef = Pick<MealRecipe, "id" | "title">
type DisplayRecipe = RecipeRef & { detail?: MealRecipe }
type DisplayDay = {
  day: Weekday
  sections: { section: MealSection; recipes: DisplayRecipe[] }[]
}
type OpenedRecipe = { recipe: MealRecipe; day: Weekday; section: MealSection }

type TimetableProps = {
  plan: MealPlan | undefined
  failed: boolean
  replace?: (day: Weekday, section: MealSection, title: string) => void
  busy?: boolean
  action?: ReactNode
  onAsk?: (recipe: RecipeRef, day: Weekday, section: MealSection) => void
  onStart?: () => void
  onForm?: () => void
  onRetry?: () => void
  draft?: MealPlanProposal | null
  onSaveDraft?: () => Promise<void>
  onDiscardDraft?: () => void
  savingDraft?: boolean
  saveError?: string | null
  suggestion?: MealPlanProposal | null
}

function todayWeekday(): Weekday {
  const day = new Date().getDay()
  return WEEKDAYS[day === 0 ? 6 : day - 1]
}

const DAY_SHORT: Record<Weekday, string> = {
  MON: "T2",
  TUE: "T3",
  WED: "T4",
  THU: "T5",
  FRI: "T6",
  SAT: "T7",
  SUN: "CN",
}

/** Day of the month for each weekday of the current week, Monday first. */
function thisWeekDates(): number[] {
  const now = new Date()
  const monday = now.getDate() - ((now.getDay() + 6) % 7)
  return WEEKDAYS.map((_, index) =>
    new Date(now.getFullYear(), now.getMonth(), monday + index).getDate()
  )
}

/** One short line per distinct problem, with every day it happens on. */
function problemLines(problems: MealPlan["problems"]) {
  const lines = new Map<string, Weekday[]>()
  for (const problem of problems) {
    const text = problem.code === "AVOIDED_INGREDIENT"
      ? `${problem.recipes.join(", ")} có ${problem.ingredients.join(", ")}`
      : problemText(problem)
    const days = lines.get(text) ?? []
    if (!days.includes(problem.day)) days.push(problem.day)
    lines.set(text, days)
  }
  return [...lines.entries()].map(([text, days]) => ({
    text,
    days: WEEKDAYS.filter((day) => days.includes(day)),
  }))
}

function recipeTime(recipe: MealRecipe | undefined) {
  if (!recipe || (recipe.prepMinutes === null && recipe.cookMinutes === null)) return null
  return (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0)
}

function displayDays(plan: MealPlan | undefined, draft: MealPlanProposal | null | undefined): DisplayDay[] {
  const savedRecipes = new Map<string, MealRecipe>()
  for (const day of plan?.days ?? []) {
    for (const section of day.sections) {
      for (const recipe of section.recipes) savedRecipes.set(recipe.id, recipe)
    }
  }

  const merged = new Map<Weekday, Map<MealSection, RecipeRef[]>>()
  for (const day of plan?.days ?? []) {
    merged.set(day.day, new Map(day.sections.map(({ section, recipes }) => [section, recipes])))
  }
  for (const day of draft?.days ?? []) {
    const sections = merged.get(day.day) ?? new Map<MealSection, RecipeRef[]>()
    for (const proposal of day.sections) {
      const changed = proposal.recipes.map(({ id }) => id).join() !== proposal.previous.map(({ id }) => id).join()
      if (changed || !plan) sections.set(proposal.section, proposal.recipes)
    }
    merged.set(day.day, sections)
  }

  return WEEKDAYS.filter((day) => merged.has(day)).map((day) => ({
    day,
    sections: [...(merged.get(day)?.entries() ?? [])].map(([section, recipes]) => ({
      section,
      recipes: recipes.map((recipe) => ({
        id: recipe.id,
        title: recipe.title,
        detail: savedRecipes.get(recipe.id),
      })),
    })),
  }))
}

/** Saved recurring week, with optional proposals and a separately staged draft. */
export function Timetable({
  plan,
  failed,
  replace,
  busy = false,
  action,
  onAsk,
  onStart,
  onForm,
  onRetry,
  draft,
  onSaveDraft,
  onDiscardDraft,
  savingDraft = false,
  saveError,
  suggestion,
}: TimetableProps) {
  const [selectedDay, setSelectedDay] = useState<Weekday | null>(null)
  const [opened, setOpened] = useState<OpenedRecipe | null>(null)
  const [today] = useState<Weekday>(todayWeekday)
  const [weekDates] = useState(thisWeekDates)
  const days = displayDays(plan, suggestion ?? draft)
  const activeDay = days.find(({ day }) => day === (selectedDay ?? today)) ?? days[0]
  const hasMeals = days.some(({ sections }) => sections.some(({ recipes }) => recipes.length > 0))
  const isDraft = Boolean(draft && !suggestion)
  const isSuggestion = Boolean(suggestion)
  const showProblems = plan !== undefined && plan.problems.length > 0 && !isDraft && !isSuggestion

  return (
    <div className="flex min-w-0 flex-col bg-card pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0 lg:min-h-full">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <h2 className="min-w-0 font-heading text-lg font-bold leading-tight">
          {isDraft ? "Bản nháp thực đơn" : isSuggestion ? "Thực đơn đề xuất" : "Thực đơn tuần"}
        </h2>
        {action}
      </header>

      {failed && plan && !isDraft && (
        <div className="px-4 pt-4 sm:px-5">
          <Alert variant="destructive">
            <TriangleAlertIcon aria-hidden />
            <AlertTitle>Chưa cập nhật được thực đơn</AlertTitle>
            <AlertDescription>
              Bạn vẫn có thể xem thực đơn đang hiển thị.
              {onRetry && (
                <Button variant="link" size="sm" className="ml-1" onClick={onRetry}>
                  Thử lại
                </Button>
              )}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {!plan && !draft && !suggestion ? (
        failed ? (
          <div className="p-4 sm:p-5">
            <Alert variant="destructive">
              <TriangleAlertIcon aria-hidden />
              <AlertTitle>Không tải được thực đơn</AlertTitle>
              <AlertDescription>
                Thử lại để xem thực đơn của bạn.
                {onRetry && (
                  <Button variant="outline" size="sm" onClick={onRetry}>
                    <RefreshCwIcon aria-hidden /> Thử lại
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 p-6 text-center">
            <Spinner aria-label="Đang tải thực đơn" />
            <p className="text-sm text-muted-foreground">Đang tải thực đơn của bạn…</p>
          </div>
        )
      ) : !hasMeals ? (
        <div className="flex min-h-72 flex-1 flex-col items-center justify-center px-6 py-10 text-center">
          <span className="mb-4 flex size-16 items-center justify-center rounded-[1.4rem] border border-primary/10 bg-secondary text-primary">
            <CalendarDaysIcon className="size-8" aria-hidden />
          </span>
          <h3 className="font-heading text-xl font-bold">Tuần này mình ăn gì?</h3>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            Trao đổi với trợ lý hoặc điền yêu cầu để tạo thực đơn phù hợp với bạn.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {onStart ? (
              <Button onClick={onStart}>
                <SparklesIcon aria-hidden /> Bắt đầu lên thực đơn
              </Button>
            ) : action}
            {onForm ? (
              <Button variant="outline" onClick={onForm}>Tạo bằng biểu mẫu</Button>
            ) : (
              <Button variant="outline" disabled title="Tạo thực đơn không dùng trợ lý đang được phát triển">
                Tạo bằng biểu mẫu
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          {showProblems && (
            <div className="px-4 pt-4 sm:px-5">
              <Alert variant="destructive">
                <TriangleAlertIcon aria-hidden />
                <AlertTitle>Thực đơn có chỗ cần xem lại</AlertTitle>
                <AlertDescription>
                  {problemLines(plan.problems).map(({ text, days: problemDays }) => (
                    <span key={text} className="block">
                      {text}
                      <span className="font-medium"> · {problemDays.map((day) => DAY_LABELS[day]).join(", ")}</span>
                    </span>
                  ))}
                  <Link href={DIETARY_PATH} className="mt-1.5 inline-block font-medium underline underline-offset-4">
                    Xem hồ sơ ăn uống
                  </Link>
                </AlertDescription>
              </Alert>
            </div>
          )}

          <div
            className="relative grid grid-cols-7 border-b border-border px-3 py-3 sm:px-4"
            role="group"
            aria-label="Chọn ngày trong thực đơn"
          >
            {activeDay && (
              <span aria-hidden className="pointer-events-none absolute inset-x-3 inset-y-3 sm:inset-x-4">
                <span
                  className="flex h-full w-[calc(100%/7)] items-end justify-center pb-1 transition-transform duration-300 ease-out motion-reduce:transition-none"
                  style={{ transform: `translateX(${WEEKDAYS.indexOf(activeDay.day) * 100}%)` }}
                >
                  <span className="size-9 rounded-full bg-primary shadow-sm" />
                </span>
              </span>
            )}
            {WEEKDAYS.map((day, index) => {
              const selected = activeDay?.day === day
              const flagged = showProblems && plan.problems.some((problem) => problem.day === day)
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={selected}
                  aria-label={DAY_LABELS[day] + (day === today ? ", hôm nay" : "") + (flagged ? ", có món cần xem lại" : "")}
                  disabled={!days.some((item) => item.day === day)}
                  onClick={() => setSelectedDay(day)}
                  className="group relative flex flex-col items-center gap-1 rounded-xl py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-40"
                >
                  <span className={cn(
                    "text-[0.6875rem] font-semibold",
                    day === today ? "text-primary" : "text-muted-foreground"
                  )}>
                    {DAY_SHORT[day]}
                  </span>
                  <span className={cn(
                    "flex size-9 items-center justify-center rounded-full text-sm font-semibold tabular-nums transition-colors duration-300",
                    selected
                      ? "text-primary-foreground"
                      : day === today
                        ? "text-primary ring-1 ring-primary/40 group-hover:bg-accent"
                        : "text-foreground group-hover:bg-accent"
                  )}>
                    {weekDates[index]}
                  </span>
                  {flagged && (
                    <span aria-hidden className="absolute top-[1.375rem] right-1/2 size-2 translate-x-[1.125rem] rounded-full bg-destructive ring-2 ring-card" />
                  )}
                </button>
              )
            })}
          </div>

          {activeDay && (
            <section key={activeDay.day} aria-label={"Các bữa " + DAY_LABELS[activeDay.day]} className="flex flex-col gap-5 px-4 py-5 sm:px-5">
              <h3 className="font-heading text-lg font-bold">
                {DAY_LABELS[activeDay.day]}
                {activeDay.day === today && (
                  <span className="ml-2 text-xs font-medium text-primary">Hôm nay</span>
                )}
              </h3>
              {activeDay.sections.map(({ section, recipes }, index) => (
                <div
                  key={section}
                  className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-300 ease-out motion-reduce:animate-none"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <h4 className="text-xs font-semibold text-muted-foreground">
                    Bữa {SECTION_LABELS[section].toLowerCase()}
                  </h4>
                  {recipes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Chưa có món</p>
                  ) : recipes.map((recipe) => (
                    <MealCard
                      key={recipe.id}
                      recipe={recipe}
                      day={activeDay.day}
                      section={section}
                      busy={busy}
                      onOpen={recipe.detail ? () => setOpened({
                        recipe: recipe.detail as MealRecipe,
                        day: activeDay.day,
                        section,
                      }) : undefined}
                      onReplace={replace}
                      disableReplace={isDraft || isSuggestion}
                      onAsk={onAsk}
                    />
                  ))}
                </div>
              ))}
            </section>
          )}

          {isDraft && (
            <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-border bg-card/95 px-4 py-4 shadow-[0_-8px_24px_-16px_rgba(20,38,26,0.2)] backdrop-blur-sm sm:bottom-0 sm:px-5">
              <p className="mb-3 text-xs text-muted-foreground">
                Thay đổi đang ở bản nháp. Chỉ được lưu khi bạn xác nhận. Lưu hoặc bỏ bản nháp trước khi đề xuất đổi món khác.
              </p>
              {saveError && <p role="alert" className="mb-3 text-sm text-destructive">{saveError}</p>}
              <div className="flex flex-wrap gap-2">
                {onSaveDraft && (
                  <Button disabled={savingDraft} onClick={() => void onSaveDraft()}>
                    {savingDraft ? <Spinner aria-hidden /> : <CheckIcon aria-hidden />}
                    {savingDraft ? "Đang lưu…" : "Lưu thực đơn"}
                  </Button>
                )}
                {onDiscardDraft && (
                  <Button variant="outline" disabled={savingDraft} onClick={onDiscardDraft}>Bỏ thay đổi</Button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={opened !== null} onOpenChange={(open) => !open && setOpened(null)}>
        {opened && (
          <RecipeDialogContent
            opened={opened}
            onAsk={onAsk ? () => {
              onAsk(opened.recipe, opened.day, opened.section)
              setOpened(null)
            } : undefined}
          />
        )}
      </Dialog>
    </div>
  )
}

function MealCard({
  recipe,
  day,
  section,
  busy,
  onOpen,
  onReplace,
  disableReplace,
  onAsk,
}: {
  recipe: DisplayRecipe
  day: Weekday
  section: MealSection
  busy: boolean
  onOpen?: () => void
  onReplace?: (day: Weekday, section: MealSection, title: string) => void
  disableReplace: boolean
  onAsk?: (recipe: RecipeRef, day: Weekday, section: MealSection) => void
}) {
  const minutes = recipeTime(recipe.detail)
  return (
    <article className="flex min-w-0 overflow-hidden rounded-2xl border border-border bg-background">
      <MealArt section={section} imageUrl={recipe.detail?.imageUrl} className="size-24 rounded-none sm:size-28" />
      <div className="flex min-w-0 flex-1 flex-col justify-center px-3.5 py-2.5">
        <h5 className="text-[0.9375rem] font-semibold leading-snug text-foreground">
          {onOpen ? (
            <button
              type="button"
              onClick={onOpen}
              className="rounded-sm text-left underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              {recipe.title}
            </button>
          ) : recipe.title}
        </h5>
        {(minutes !== null || (recipe.detail && recipe.detail.servings > 0)) && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[
              minutes !== null ? minutes + " phút" : null,
              recipe.detail && recipe.detail.servings > 0 ? recipe.detail.servings + " khẩu phần" : null,
            ].filter(Boolean).join(" · ")}
          </p>
        )}
        {(onReplace || onAsk) && (
          <div className="mt-1.5 -ml-2 flex flex-wrap gap-x-1">
            {onReplace && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy || disableReplace}
                title={disableReplace ? "Lưu hoặc bỏ bản nháp trước khi đề xuất đổi món khác" : undefined}
                onClick={() => onReplace(day, section, recipe.title)}
                aria-label={"Đổi món " + recipe.title + ", " + DAY_LABELS[day] + ", bữa " + SECTION_LABELS[section].toLowerCase()}
              >
                <RefreshCwIcon aria-hidden /> Đổi món
              </Button>
            )}
            {onAsk && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAsk(recipe, day, section)}
                aria-label={"Hỏi trợ lý về " + recipe.title + ", " + DAY_LABELS[day] + ", bữa " + SECTION_LABELS[section].toLowerCase()}
              >
                <MessageCircleIcon aria-hidden /> Hỏi trợ lý
              </Button>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

function RecipeDialogContent({ opened, onAsk }: { opened: OpenedRecipe; onAsk?: () => void }) {
  const { recipe, day, section } = opened
  // Focus the dialog itself: focusing its first button would scroll past the photo.
  const popup = useRef<HTMLDivElement>(null)
  const minutes = recipeTime(recipe)
  const details = [
    recipe.servings > 0 ? recipe.servings + " khẩu phần" : null,
    minutes !== null ? "khoảng " + minutes + " phút" : null,
  ].filter(Boolean).join(" · ")
  return (
    <DialogContent ref={popup} initialFocus={popup} className="max-h-[85dvh] overflow-y-auto">
      <MealArt section={section} imageUrl={recipe.imageUrl} photoOnly className="aspect-[16/9] size-auto w-full" />
      <DialogHeader>
        <p className="text-xs font-semibold text-primary">
          {DAY_LABELS[day]} · Bữa {SECTION_LABELS[section].toLowerCase()}
        </p>
        <DialogTitle size="lg">{recipe.title}</DialogTitle>
        <DialogDescription>{details}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4 text-sm">
        <section className="flex flex-col gap-2">
          <h4 className="font-semibold">Nguyên liệu</h4>
          {recipe.ingredients.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5">
              {recipe.ingredients.map(({ name, quantity, unit, note }, index) => (
                <li key={name + "-" + index}>
                  {[quantity, unit].filter((part) => part !== null && part !== "").join(" ")} {name}
                  {note && <span className="text-muted-foreground">, {note}</span>}
                </li>
              ))}
            </ul>
          ) : <p className="text-muted-foreground">Chưa có danh sách nguyên liệu.</p>}
        </section>
        {recipe.steps.length > 0 && (
          <section className="flex flex-col gap-2">
            <h4 className="font-semibold">Cách làm</h4>
            <ol className="list-decimal space-y-2 pl-5">
              {recipe.steps.map((step, index) => <li key={index}>{step}</li>)}
            </ol>
          </section>
        )}
        {onAsk && (
          <Button variant="outline" className="self-start" onClick={onAsk}>
            <MessageCircleIcon aria-hidden /> Hỏi trợ lý về món này
          </Button>
        )}
      </div>
    </DialogContent>
  )
}
