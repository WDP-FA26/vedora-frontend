"use client"

import { CalendarCheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { PlanChangeEntry } from "@/features/meal-plan/lib/chat-message-parsers"
import { DAY_LABELS, SECTION_LABELS, weekStartRangeLabel } from "@/features/meal-plan/lib/dates"
import type { MealPlanProblem } from "@/features/meal-plan/schemas/meal-plan.schema"

function leftOutLabel(problem: MealPlanProblem) {
  const day = DAY_LABELS[problem.day]
  if (problem.code === "UNKNOWN_RECIPE") return `${day}: món không còn trong kho`
  return `${day}: ${problem.recipes.join(", ")} (có ${problem.ingredients.join(", ")} bạn không ăn)`
}

export function PlanChangeCard({
  change,
  currentWeek,
  onShowWeek,
}: {
  change: PlanChangeEntry
  currentWeek: string | undefined
  onShowWeek?: (weekStart: string) => void
}) {
  const titles = (recipes: { title: string }[]) => recipes.map(({ title }) => title).join(", ")
  const clashes = change.problems.filter(({ code }) => code === "DAY_CONFLICT")
  const leftOut = change.problems.filter(({ code }) => code !== "DAY_CONFLICT")

  return (
    <article aria-label="Thực đơn đã cập nhật" className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-start gap-2">
        <CalendarCheckIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Đã cập nhật thực đơn</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Tuần {weekStartRangeLabel(change.weekStart)}
            {change.weekStart === currentWeek ? " · đang xem trên lịch" : ""}
          </p>
        </div>
        {onShowWeek && (
          <span className="shrink-0">
            <Button variant="link" size="xs" onClick={() => onShowWeek(change.weekStart)}>
              Xem lịch
            </Button>
          </span>
        )}
      </div>
      {change.days.map(({ day, sections }) => (
        <section key={day} className="mt-2.5 border-t border-border pt-2">
          <h4 className="text-xs font-semibold text-muted-foreground">{DAY_LABELS[day]}</h4>
          <dl className="mt-1 text-sm leading-6">
            {sections.map(({ section, recipes, previous }) => {
              const same =
                recipes.length === previous.length &&
                recipes.every(({ id }, index) => id === previous[index].id)
              if (same) return null
              return (
                <div key={section} className="flex gap-3">
                  <dt className="w-10 shrink-0 text-muted-foreground">{SECTION_LABELS[section]}</dt>
                  <dd className="min-w-0">
                    {recipes.length > 0 ? titles(recipes) : <span className="text-muted-foreground">Để trống</span>}
                    {previous.length > 0 && (
                      <span className="text-muted-foreground"> · thay {titles(previous)}</span>
                    )}
                  </dd>
                </div>
              )
            })}
          </dl>
        </section>
      ))}
      {clashes.length > 0 && (
        <p className="mt-2 rounded-lg bg-amber-500/15 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-300">
          Lưu ý: có món không nên ăn cùng ngày ({clashes.map(({ ingredients }) => ingredients.join(" + ")).join("; ")}).
        </p>
      )}
      {leftOut.length > 0 && (
        <p className="mt-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
          Không thêm: {leftOut.map(leftOutLabel).join("; ")}.
        </p>
      )}
    </article>
  )
}
