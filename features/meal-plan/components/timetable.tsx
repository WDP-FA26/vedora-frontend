"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import {
  BookOpenIcon,
  CalendarDaysIcon,
  CheckIcon,
  Clock3Icon,
  MessageCircleIcon,
  RefreshCwIcon,
  SparklesIcon,
  TriangleAlertIcon,
  UsersRoundIcon,
  UtensilsCrossedIcon,
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
  onStageSuggestion?: () => void
  onDismissSuggestion?: () => void
}

function todayWeekday(): Weekday {
  const day = new Date().getDay()
  return WEEKDAYS[day === 0 ? 6 : day - 1]
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
  onStageSuggestion,
  onDismissSuggestion,
}: TimetableProps) {
  const [selectedDay, setSelectedDay] = useState<Weekday | null>(null)
  const [opened, setOpened] = useState<OpenedRecipe | null>(null)
  const [today] = useState<Weekday>(todayWeekday)
  const days = displayDays(plan, suggestion ?? draft)
  const activeDay = days.find(({ day }) => day === selectedDay) ?? days[0]
  const hasMeals = days.some(({ sections }) => sections.some(({ recipes }) => recipes.length > 0))
  const hasSavedMeals = Boolean(plan?.days.some(({ sections }) => sections.some(({ recipes }) => recipes.length > 0)))
  const isDraft = Boolean(draft && !suggestion)
  const isSuggestion = Boolean(suggestion)
  const suggestedChanges = suggestion?.days.flatMap(({ day, sections }) =>
    sections
      .filter(({ recipes, previous }) => recipes.map(({ id }) => id).join() !== previous.map(({ id }) => id).join())
      .map(({ section, recipes, previous }) => ({ day, section, recipes, previous }))
  ) ?? []

  return (
    <div className="flex min-w-0 flex-col bg-card pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0 lg:min-h-full">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
            <CalendarDaysIcon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-lg font-bold leading-tight">Thực đơn tuần</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isDraft ? "Xem lại trước khi lưu" : isSuggestion ? "Đề xuất để bạn xem trước" : "Lặp lại theo thứ trong tuần"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasMeals && (
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
              isDraft || isSuggestion ? "bg-brand-cream/55 text-foreground" : "bg-secondary text-primary"
            )}>
              {isDraft || isSuggestion ? (
                <span className="size-1.5 rounded-full bg-brand-orange" />
              ) : (
                <CheckIcon className="size-3.5" aria-hidden />
              )}
              {isDraft ? "Có thay đổi chưa lưu" : isSuggestion ? "Đề xuất chưa áp dụng" : "Đã lưu"}
            </span>
          )}
          {action}
        </div>
      </header>

      {suggestion && (
        <div className="border-b border-border bg-secondary/35 px-4 py-4 sm:px-5">
          <div className="rounded-2xl border border-primary/20 bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-primary">
              <SparklesIcon className="size-4" aria-hidden />
              Đề xuất của trợ lý
            </div>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
              {draft
                ? "Bản nháp hiện tại vẫn được giữ. Kiểm tra đề xuất mới trước khi thay bản nháp."
                : hasSavedMeals
                  ? "Thực đơn đã lưu chưa thay đổi. Kiểm tra món được đề xuất trước khi đưa vào bản nháp."
                  : "Kiểm tra món được đề xuất trước khi đưa vào bản nháp."}
            </p>
            <ul className="mt-3 space-y-2 text-xs">
              {suggestedChanges.map(({ day, section, recipes, previous }) => (
                <li key={`${day}-${section}`} className="rounded-xl bg-secondary/50 px-3 py-2">
                  <span className="block font-semibold">{DAY_LABELS[day]} · Bữa {SECTION_LABELS[section].toLowerCase()}</span>
                  <span className="mt-1 block text-muted-foreground">{previous.map(({ title }) => title).join(", ") || "Chưa có món"} → <strong className="text-foreground">{recipes.map(({ title }) => title).join(", ") || "Để trống"}</strong></span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestedChanges.length > 0 && onStageSuggestion && (
                <Button size="sm" onClick={onStageSuggestion}>Áp dụng vào bản nháp</Button>
              )}
              {onDismissSuggestion && (
                <Button variant="outline" size="sm" onClick={onDismissSuggestion}>
                  {hasSavedMeals ? "Giữ thực đơn hiện tại" : "Bỏ đề xuất"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

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
          {plan && plan.problems.length > 0 && !isDraft && !isSuggestion && (
            <div className="px-4 pt-4 sm:px-5">
              <Alert variant="destructive">
                <TriangleAlertIcon aria-hidden />
                <AlertTitle>Thực đơn có chỗ cần xem lại</AlertTitle>
                <AlertDescription>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {plan.problems.map((problem, index) => (
                      <li key={index}>{DAY_LABELS[problem.day]}: {problemText(problem)}</li>
                    ))}
                  </ul>
                  <Link href={DIETARY_PATH} className="mt-2 inline-block font-medium underline underline-offset-4">
                    Xem hồ sơ ăn uống
                  </Link>
                </AlertDescription>
              </Alert>
            </div>
          )}

          <div className="border-b border-border px-4 py-4 sm:px-5">
            <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {days.length} ngày · Chọn ngày để xem các bữa
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]" role="group" aria-label="Chọn ngày trong thực đơn">
              {days.map(({ day }) => (
                <button
                  key={day}
                  type="button"
                  aria-pressed={activeDay?.day === day}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "flex min-w-[4.6rem] shrink-0 flex-col items-center rounded-2xl border px-3 py-2.5 text-center outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/30",
                    activeDay?.day === day
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-background text-foreground hover:border-primary/35 hover:bg-accent"
                  )}
                >
                  <span className="text-xs font-semibold">{DAY_LABELS[day]}</span>
                  {day === today && (
                    <span className={cn(
                      "mt-1 text-[0.65rem]",
                      activeDay?.day === day ? "text-primary-foreground/80" : "text-primary"
                    )}>Hôm nay</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {activeDay && (
            <section aria-label={"Các bữa " + DAY_LABELS[activeDay.day]} className="flex flex-col gap-4 px-4 py-5 sm:px-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-heading text-lg font-bold">{DAY_LABELS[activeDay.day]}</h3>
                <span className="text-xs text-muted-foreground">
                  {activeDay.sections.reduce((count, section) => count + section.recipes.length, 0)} món
                </span>
              </div>
              {activeDay.sections.map(({ section, recipes }) => (
                <div key={section} className="space-y-2.5">
                  <h4 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                    Bữa {SECTION_LABELS[section].toLowerCase()}
                  </h4>
                  {recipes.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                      Chưa có món cho bữa này
                    </div>
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
    <article className="overflow-hidden rounded-[1.25rem] border border-border bg-background shadow-[0_4px_18px_-12px_rgba(20,38,26,0.35)]">
      <div className="flex min-w-0 gap-3 p-3">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-secondary/75 text-primary" aria-hidden>
          <UtensilsCrossedIcon className="size-6" />
        </span>
        <div className="min-w-0 flex-1 self-center">
          <h5 className="font-heading text-sm font-semibold leading-snug text-foreground">{recipe.title}</h5>
          {(minutes !== null || (recipe.detail && recipe.detail.servings > 0)) && (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {minutes !== null && (
                <span className="inline-flex items-center gap-1"><Clock3Icon className="size-3.5" aria-hidden />{minutes} phút</span>
              )}
              {recipe.detail && recipe.detail.servings > 0 && (
                <span className="inline-flex items-center gap-1"><UsersRoundIcon className="size-3.5" aria-hidden />{recipe.detail.servings} khẩu phần</span>
              )}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1 border-t border-border px-2.5 py-2">
        {onOpen && (
          <Button variant="ghost" size="sm" onClick={onOpen}>
            <BookOpenIcon aria-hidden /> Xem công thức
          </Button>
        )}
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
    </article>
  )
}

function RecipeDialogContent({ opened, onAsk }: { opened: OpenedRecipe; onAsk?: () => void }) {
  const { recipe, day, section } = opened
  const minutes = recipeTime(recipe)
  const details = [
    recipe.servings > 0 ? recipe.servings + " khẩu phần" : null,
    minutes !== null ? "khoảng " + minutes + " phút" : null,
  ].filter(Boolean).join(" · ")
  return (
    <DialogContent className="max-h-[85dvh] overflow-y-auto">
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
