"use client"

import { vietnamHour } from "@/features/shared/lib/date-time"

import { useState } from "react"
import {
  BookOpenIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FlameIcon,
  SparklesIcon,
  UtensilsIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { SECTION_LABELS } from "@/features/meal-plan/lib/dates"
import type { MealLogWeek } from "@/features/meal-plan/schemas/meal-log.schema"
import {
  MEAL_SECTIONS,
  type MealPlan,
  type MealRecipe,
  type MealSection,
  type Weekday,
} from "@/features/meal-plan/schemas/meal-plan.schema"
import { cn } from "@/lib/utils"

function currentMealSection(): MealSection {
  const hour = vietnamHour()
  if (hour < 10) return "BREAKFAST"
  if (hour < 15) return "LUNCH"
  if (hour < 21) return "DINNER"
  return "OTHER"
}

export function TodayFocusStrip({
  plan,
  today,
  mealLog,
  dailyCalorieTarget,
  eatenEntryBySlotRecipe,
  eatingBusyKey,
  onOpenDish,
  onToggleEaten,
  onSwapSection,
  onLogEatingOut,
}: {
  plan: MealPlan
  today: Weekday
  mealLog?: MealLogWeek
  dailyCalorieTarget: number | null
  eatenEntryBySlotRecipe: ReadonlyMap<string, string>
  eatingBusyKey: string | null
  onOpenDish: (day: Weekday, section: MealSection, recipe: MealRecipe) => void
  onToggleEaten: (
    day: Weekday,
    date: string,
    section: MealSection,
    recipeId: string,
    existingEntryId?: string
  ) => void
  onSwapSection: (day: Weekday, section: MealSection) => void
  onLogEatingOut: () => void
}) {
  const [collapsed, setCollapsed] = useState(true)
  const [section, setSection] = useState<MealSection>(currentMealSection)

  const todayPlan = plan.days.find((item) => item.day === today)
  if (!todayPlan) return null

  const todayLog = mealLog?.days.find((item) => item.day === today)
  const loggedKcal = todayLog?.loggedCalories ?? 0
  const recipes =
    todayPlan.sections.find((item) => item.section === section)?.recipes ?? []

  return (
    <section
      aria-label="Tập trung hôm nay"
      className="hidden border-b border-border bg-primary/[0.03] px-3 py-1.5 text-xs md:block sm:px-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-expanded={!collapsed}
            className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary"
          >
            {collapsed ? (
              <ChevronDownIcon aria-hidden className="size-3.5" />
            ) : (
              <ChevronUpIcon aria-hidden className="size-3.5" />
            )}
            Hôm nay
          </button>

          <div className="flex items-center gap-1" role="tablist" aria-label="Chọn bữa hôm nay">
            {MEAL_SECTIONS.map((item) => {
              const active = section === item
              const count =
                todayPlan.sections.find((sec) => sec.section === item)?.recipes.length ?? 0
              return (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setSection(item)
                    if (collapsed) setCollapsed(false)
                  }}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[0.6875rem] font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  {SECTION_LABELS[item]}
                  {count > 0 ? ` (${count})` : ""}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[0.6875rem] font-medium tabular-nums text-foreground ring-1 ring-border">
            <FlameIcon aria-hidden className="size-3 text-amber-600 dark:text-amber-400" />
            Đã ăn {loggedKcal.toLocaleString("vi-VN")}
            {dailyCalorieTarget !== null
              ? ` / ${dailyCalorieTarget.toLocaleString("vi-VN")} kcal`
              : " kcal"}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onLogEatingOut}
            title="Ghi món ăn ngoài vào nhật ký hôm nay"
          >
            <UtensilsIcon aria-hidden />
            Ăn ngoài
          </Button>
        </div>
      </div>

      {!collapsed && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {recipes.length === 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
              <span>Bữa {SECTION_LABELS[section].toLowerCase()} hôm nay chưa có món.</span>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => onSwapSection(today, section)}
              >
                <SparklesIcon aria-hidden />
                Gợi ý món
              </Button>
            </div>
          ) : (
            <>
              {recipes.map((recipe) => {
                const key = `${today}:${section}:${recipe.id}`
                const entryId = eatenEntryBySlotRecipe.get(key)
                const eaten = entryId !== undefined
                const busy = eatingBusyKey === key
                return (
                  <div
                    key={recipe.id}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs",
                      eaten
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                        : "border-border bg-card text-foreground"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenDish(today, section, recipe)}
                      className="inline-flex items-center gap-1 font-medium hover:underline"
                      title="Xem công thức"
                    >
                      <BookOpenIcon aria-hidden className="size-3 text-primary" />
                      <span className="max-w-44 truncate">{recipe.title}</span>
                    </button>
                    <Button
                      type="button"
                      variant={eaten ? "secondary" : "ghost"}
                      size="xs"
                      shape="pill"
                      disabled={busy}
                      aria-pressed={eaten}
                      onClick={() =>
                        onToggleEaten(today, todayPlan.date, section, recipe.id, entryId)
                      }
                    >
                      <CheckIcon aria-hidden className="size-3" />
                      {eaten ? "Đã ăn" : "Ăn"}
                    </Button>
                  </div>
                )
              })}
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => onSwapSection(today, section)}
                title="Nhờ trợ lý đổi món cho bữa này"
              >
                <SparklesIcon aria-hidden />
                Đổi món
              </Button>
            </>
          )}
        </div>
      )}
    </section>
  )
}
