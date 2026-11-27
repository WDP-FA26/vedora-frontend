"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { NUTRITION_PILLAR_META, type NutritionProfile } from "@/features/dietary/dietary"
import { DAY_LABELS, DAY_SHORT } from "@/features/meal-plan/lib/dates"
import {
  computeWeekNutrition,
  type DayCalorieStatus,
  type DayNutritionSummary,
} from "@/features/meal-plan/lib/nutrition"
import type { MealLogWeek } from "@/features/meal-plan/schemas/meal-log.schema"
import type { MealPlan } from "@/features/meal-plan/schemas/meal-plan.schema"

const weeklyChartConfig = {
  calories: { label: "Kế hoạch", color: "var(--chart-1)" },
  loggedCalories: { label: "Đã ăn thực tế", color: "#3b82f6" },
} satisfies ChartConfig

function barColorForStatus(status: DayCalorieStatus): string {
  if (status === "ON_TARGET") return "#10b981"
  if (status === "LOW" || status === "HIGH") return "#f59e0b"
  if (status === "PARTIAL") return "#94a3b8"
  return "#e2e8f0"
}

function statusLabel(summary: DayNutritionSummary): string {
  if (summary.calorieStatus === "EMPTY") return "Chưa xếp món"
  if (summary.calorieStatus === "PARTIAL") {
    return `Đã xếp ${summary.filledMainMeals}/3 bữa chính (có thể có bữa ăn ngoài)`
  }
  if (summary.calorieStatus === "LOW") return "Năng lượng hơi thấp cho cả ngày"
  if (summary.calorieStatus === "HIGH") return "Năng lượng khá cao so với mục tiêu"
  return "Hài hòa trong vùng mục tiêu"
}

function WeeklyCalorieTooltip({
  active,
  label,
  byDay,
}: Pick<TooltipContentProps<number, string>, "active" | "label"> & {
  byDay: Map<string, DayNutritionSummary & { shortDay: string; loggedCalories: number }>
}) {
  if (!active || typeof label !== "string") return null
  const item = byDay.get(label)
  if (!item) return null

  return (
    <div className="grid min-w-52 gap-1.5 rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-foreground">{DAY_LABELS[item.day]}</p>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Kế hoạch ước tính</span>
        <span className="font-semibold tabular-nums">~{item.calories} kcal</span>
      </div>
      {item.loggedCalories > 0 && (
        <div className="flex justify-between gap-4">
          <span className="text-blue-600 dark:text-blue-400">Đã ăn thực tế</span>
          <span className="font-semibold tabular-nums text-blue-600 dark:text-blue-400">
            ~{item.loggedCalories} kcal
          </span>
        </div>
      )}
      <p className="text-muted-foreground">{statusLabel(item)}</p>
      {item.pillars.length > 0 && (
        <p className="text-primary">
          Có: {item.pillars.map((pillar) => NUTRITION_PILLAR_META[pillar].shortLabel).join(", ")}
        </p>
      )}
      {item.hints.map((hint) => (
        <p key={hint} className="text-amber-700 dark:text-amber-300">
          • {hint}
        </p>
      ))}
    </div>
  )
}

export function WeeklyCalorieBarChart({
  plan,
  nutrition,
  mealLog,
}: {
  plan: MealPlan
  nutrition: NutritionProfile | undefined
  mealLog?: MealLogWeek
}) {
  const weekSummary = computeWeekNutrition(plan, nutrition)
  const loggedByDay = new Map((mealLog?.days ?? []).map((item) => [item.day, item.loggedCalories]))
  const rows = weekSummary.days.map((item) => ({
    ...item,
    shortDay: DAY_SHORT[item.day],
    loggedCalories: loggedByDay.get(item.day) ?? 0,
  }))
  const hasAnyLogged = rows.some((row) => row.loggedCalories > 0)
  const byShortDay = new Map(rows.map((row) => [row.shortDay, row]))
  const target = nutrition?.dailyCalorieTarget ?? null

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold">
            {hasAnyLogged ? "Kế hoạch vs. Thực tế trong tuần" : "Năng lượng ước tính trong tuần"}
          </h3>
          <p className="text-xs text-muted-foreground">
            Tính theo khẩu phần 1 người ăn (ước tính tương đối)
          </p>
        </div>
        {target !== null && <Badge variant="outline">Mục tiêu: ~{target} kcal/ngày</Badge>}
      </div>

      <figure>
        <ChartContainer
          config={weeklyChartConfig}
          className="aspect-auto h-52 w-full"
          aria-label="Biểu đồ năng lượng ước tính 7 ngày trong tuần"
        >
          <BarChart data={rows} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="shortDay" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis axisLine={false} tickLine={false} width={44} tickCount={4} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.35 }}
              content={({ active, label }) => (
                <WeeklyCalorieTooltip active={active} label={label} byDay={byShortDay} />
              )}
            />
            {target !== null && (
              <ReferenceLine
                y={target}
                stroke="var(--primary)"
                strokeDasharray="4 4"
                label={{
                  value: `${target} kcal`,
                  position: "insideTopRight",
                  fill: "var(--muted-foreground)",
                  fontSize: 11,
                }}
              />
            )}
            <Bar dataKey="calories" radius={[6, 6, 0, 0]} maxBarSize={hasAnyLogged ? 20 : 36}>
              {rows.map((entry) => (
                <Cell key={entry.day} fill={barColorForStatus(entry.calorieStatus)} />
              ))}
            </Bar>
            {hasAnyLogged && (
              <Bar dataKey="loggedCalories" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={20} />
            )}
          </BarChart>
        </ChartContainer>
        <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.6875rem] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-xs bg-emerald-500" />
            Đủ 3 bữa, hợp vùng mục tiêu
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-xs bg-amber-500" />
            Đủ 3 bữa, lệch khá nhiều
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-xs bg-slate-400" />
            Ngày mới xếp 1–2 bữa
          </span>
          {hasAnyLogged && (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-xs bg-blue-500" />
              Đã ăn thực tế
            </span>
          )}
        </figcaption>
      </figure>
    </div>
  )
}
