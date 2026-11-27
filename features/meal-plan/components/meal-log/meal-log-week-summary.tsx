"use client"

import { SparklesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { kcal } from "@/features/meal-plan/components/meal-log/meal-log-utils"
import { DAY_LABELS, DAY_SHORT } from "@/features/meal-plan/lib/dates"
import type { MealLogDay, MealLogWeek } from "@/features/meal-plan/schemas/meal-log.schema"
import type { Weekday } from "@/features/meal-plan/schemas/meal-plan.schema"
import { cn } from "@/lib/utils"

function dayAriaLabel(day: MealLogDay, today: string) {
  const parts = [DAY_LABELS[day.day]]
  if (day.date === today) parts.push("hôm nay")
  if (day.entries.length > 0) parts.push(`đã ghi ${kcal(day.loggedCalories)}`)
  return parts.join(", ")
}

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

export function MealLogWeekSummary({
  week,
  selectedDay,
  onPickDay,
  onReview,
}: {
  week: MealLogWeek
  selectedDay: Weekday
  onPickDay: (day: Weekday) => void
  onReview?: (week: MealLogWeek) => void
}) {
  const { summary, dailyCalorieTarget } = week
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
                {DAY_SHORT[item.day]}
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
