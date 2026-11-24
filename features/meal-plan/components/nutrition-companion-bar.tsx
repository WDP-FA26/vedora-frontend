"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  ActivityIcon,
  BarChart3Icon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  ScaleIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from "lucide-react"
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
import { Button } from "@/components/ui/button"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AsianBmiSpectrumBar,
  NutritionProfileForm,
  WeightBmiTrendChart,
  WeightQuickCheckIn,
} from "@/features/dietary/components/bmi-charts"
import {
  BMI_CATEGORY_META,
  DIETARY_PATH,
  NUTRITION_GOAL_LABELS,
  NUTRITION_PILLARS,
  NUTRITION_PILLAR_META,
  type NutritionProfile,
} from "@/features/dietary/dietary"
import { DAY_SHORT } from "@/features/meal-plan/components/timetable"
import {
  computeWeekNutrition,
  DAY_LABELS,
  type DayCalorieStatus,
  type DayNutritionSummary,
  type MealPlan,
} from "@/features/meal-plan/meal-plan"
import {
  isFreshFocus,
  VOICE_GLOW_MS,
  VOICE_HIGHLIGHT,
  VOICE_POINT_MS,
  type VoiceFocusRequest,
} from "@/features/meal-plan/voice"
import { cn } from "@/lib/utils"

const weeklyChartConfig = {
  calories: { label: "Calo ước tính", color: "var(--chart-1)" },
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
  byDay: Map<string, DayNutritionSummary & { shortDay: string }>
}) {
  if (!active || typeof label !== "string") return null
  const item = byDay.get(label)
  if (!item) return null

  return (
    <div className="grid min-w-52 gap-1.5 rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-foreground">{DAY_LABELS[item.day]}</p>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Năng lượng ước tính</span>
        <span className="font-semibold tabular-nums">~{item.calories} kcal</span>
      </div>
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

/**
 * Chart 3: 7-day calorie distribution BarChart vs daily target reference line,
 * distinguishing full 3-meal days from partial days so eating-out schedules don't look broken.
 */
function WeeklyCalorieBarChart({
  plan,
  nutrition,
}: {
  plan: MealPlan
  nutrition: NutritionProfile | undefined
}) {
  const weekSummary = computeWeekNutrition(plan, nutrition)
  const rows = weekSummary.days.map((item) => ({
    ...item,
    shortDay: DAY_SHORT[item.day],
  }))
  const byShortDay = new Map(rows.map((row) => [row.shortDay, row]))
  const target = nutrition?.dailyCalorieTarget ?? null

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold">Năng lượng ước tính trong tuần</h3>
          <p className="text-xs text-muted-foreground">
            Tính theo khẩu phần 1 người ăn (ước tính tương đối)
          </p>
        </div>
        {target !== null && (
          <Badge variant="outline">Mục tiêu: ~{target} kcal/ngày</Badge>
        )}
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
            <Bar dataKey="calories" radius={[6, 6, 0, 0]} maxBarSize={36}>
              {rows.map((entry) => (
                <Cell key={entry.day} fill={barColorForStatus(entry.calorieStatus)} />
              ))}
            </Bar>
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
        </figcaption>
      </figure>
    </div>
  )
}

function buildBalancePrompt(
  plan: MealPlan,
  nutrition: NutritionProfile | undefined,
): string {
  const weekSummary = computeWeekNutrition(plan, nutrition)
  if (weekSummary.plannedDayCount === 0) {
    return "Hãy gợi ý cho mình thực đơn chay cả tuần cân đối theo chỉ số BMI và đủ 5 nhóm dưỡng chất chay nhé."
  }
  const missingNames = weekSummary.missingPillars.map(
    (pillar) => NUTRITION_PILLAR_META[pillar].label.toLowerCase(),
  )
  if (missingNames.length > 0) {
    return `Nhờ trợ lý xem lại thực đơn tuần này giúp mình: mình muốn cân đối theo mục tiêu cân nặng và bổ sung thêm nhóm ${missingNames.join(", ")} nhé.`
  }
  return "Nhờ trợ lý nhận xét thực đơn tuần này xem lượng calo ước tính và 5 nhóm chất chay (Đạm, Xơ, Sắt, Canxi, Béo tốt) đã hài hòa với BMI của mình chưa?"
}

/**
 * Compact companion banner above the calendar grid plus a rich side sheet housing
 * all 3 charts (Weekly Calories, Asian BMI Spectrum, Weight/BMI Trend) and check-in tools.
 */
export function NutritionCompanionBar({
  plan,
  nutrition,
  onNutritionSaved,
  onAskAssistant,
  trailing,
  voiceFocus,
}: {
  plan: MealPlan
  nutrition: NutritionProfile | undefined
  onNutritionSaved: (next: NutritionProfile) => Promise<void> | void
  onAskAssistant?: (prompt: string) => void
  trailing?: ReactNode
  /** The voice agent's request to show the BMI panel. */
  voiceFocus?: VoiceFocusRequest<object>
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"weekly" | "bmi">("weekly")
  const [glowBmi, setGlowBmi] = useState(false)
  const [handledFocus, setHandledFocus] = useState(0)

  // The voice agent "clicks" the BMI chip: it glows, then the BMI tab opens.
  useEffect(() => {
    if (!voiceFocus || voiceFocus.nonce === handledFocus || !isFreshFocus(voiceFocus)) return
    const nonce = voiceFocus.nonce
    const timers = [
      setTimeout(() => {
        setHandledFocus(nonce)
        setGlowBmi(true)
      }, 0),
      setTimeout(() => {
        setActiveTab("bmi")
        setSheetOpen(true)
      }, VOICE_POINT_MS),
      setTimeout(() => setGlowBmi(false), VOICE_GLOW_MS),
    ]
    return () => timers.forEach(clearTimeout)
  }, [voiceFocus, handledFocus])
  const [editingProfile, setEditingProfile] = useState(false)

  const weekSummary = computeWeekNutrition(plan, nutrition)
  const hasBmi = nutrition !== undefined && nutrition.bmi !== null && nutrition.bmiCategory !== null
  const goalInfo = nutrition?.effectiveGoal
    ? NUTRITION_GOAL_LABELS[nutrition.effectiveGoal]
    : null
  const daysWithHints = weekSummary.days.filter((day) => day.hints.length > 0)
  const coveredPillarCount = NUTRITION_PILLARS.length - weekSummary.missingPillars.length

  function openSheet(tab: "weekly" | "bmi") {
    setActiveTab(tab)
    setSheetOpen(true)
  }

  let bmiLabel = "Thiết lập BMI & mục tiêu calo"
  if (hasBmi && nutrition.bmiCategory) {
    const parts = [`BMI ${nutrition.bmi?.toFixed(1)} (${BMI_CATEGORY_META[nutrition.bmiCategory].label})`]
    if (goalInfo && nutrition.dailyCalorieTarget) {
      parts.push(`${goalInfo.shortLabel} ~${nutrition.dailyCalorieTarget} kcal/ngày`)
    }
    bmiLabel = parts.join(" · ")
  }

  function renderBmiTabContent() {
    if (!nutrition) {
      return <p className="text-sm text-muted-foreground">Đang tải hồ sơ BMI…</p>
    }
    if (!hasBmi) {
      return (
        <>
          <AsianBmiSpectrumBar profile={nutrition} />
          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-bold">Thiết lập thông số cơ thể &amp; mục tiêu</h3>
            <NutritionProfileForm
              key={`${nutrition.heightCm}-${nutrition.weightKg}-${nutrition.nutritionGoal}`}
              profile={nutrition}
              onSaved={onNutritionSaved}
            />
          </div>
          <Link
            href={DIETARY_PATH}
            className="inline-block text-xs font-semibold text-primary underline-offset-4 hover:underline"
          >
            Mở Hồ sơ dị ứng &amp; thực phẩm kiêng
          </Link>
        </>
      )
    }
    return (
      <>
        <AsianBmiSpectrumBar profile={nutrition} />
        <WeightQuickCheckIn profile={nutrition} onSaved={onNutritionSaved} />
        <WeightBmiTrendChart profile={nutrition} />
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setEditingProfile((open) => !open)}
            >
              {editingProfile ? <ChevronUpIcon aria-hidden /> : <ChevronDownIcon aria-hidden />}
              Chỉnh chiều cao &amp; mục tiêu
            </Button>
            <Link
              href={DIETARY_PATH}
              className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
            >
              Hồ sơ dị ứng &amp; thực phẩm kiêng
            </Link>
          </div>
          {editingProfile && (
            <div className="mt-3 border-t border-border pt-3">
              <NutritionProfileForm
                key={`${nutrition.heightCm}-${nutrition.weightKg}-${nutrition.nutritionGoal}`}
                profile={nutrition}
                onSaved={async (updated) => {
                  await onNutritionSaved(updated)
                  setEditingProfile(false)
                }}
              />
            </div>
          )}
        </div>
      </>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/20 px-3 py-2 text-xs sm:px-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openSheet("bmi")}
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 font-medium transition-colors hover:border-primary/40",
              glowBmi && VOICE_HIGHLIGHT
            )}
          >
            <ScaleIcon aria-hidden className="size-3.5 shrink-0 text-primary" />
            <span className="truncate tabular-nums">{bmiLabel}</span>
          </button>

          {weekSummary.plannedDayCount > 0 && (
            <button
              type="button"
              onClick={() => openSheet("weekly")}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium tabular-nums transition-colors",
                weekSummary.missingPillars.length === 0
                  ? "bg-primary/10 text-primary hover:bg-primary/15"
                  : "bg-amber-500/15 text-amber-800 hover:bg-amber-500/20 dark:text-amber-300"
              )}
              title="Xem chi tiết 5 nhóm dưỡng chất chay và biểu đồ calo tuần"
            >
              {coveredPillarCount}/{NUTRITION_PILLARS.length} nhóm chất chay
            </button>
          )}

          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => openSheet("weekly")}
          >
            <BarChart3Icon aria-hidden />
            Biểu đồ &amp; Cân nặng
          </Button>
        </div>

        {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Trợ lý Dinh dưỡng & Theo dõi BMI</SheetTitle>
            <SheetDescription>
              Mọi con số calo và BMI chỉ mang tính tham khảo tương đối để giúp bạn ăn chay đủ chất và nhẹ nhàng hơn.
            </SheetDescription>
          </SheetHeader>

          <div className="px-6 pb-6">
            <Tabs
              value={activeTab}
              onValueChange={(next) => setActiveTab(next as "weekly" | "bmi")}
            >
              <TabsList className="mb-4 grid w-full grid-cols-2">
                <TabsTrigger value="weekly">
                  <BarChart3Icon aria-hidden /> Tuần này & Đĩa chay
                </TabsTrigger>
                <TabsTrigger value="bmi">
                  <ActivityIcon aria-hidden /> BMI & Xu hướng
                </TabsTrigger>
              </TabsList>

              <TabsContent value="weekly">
                <div className="space-y-4">
                  <WeeklyCalorieBarChart plan={plan} nutrition={nutrition} />

                <div className="space-y-2.5 rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold">Đĩa dinh dưỡng chay tuần này</h3>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {weekSummary.plannedDayCount} ngày có món
                    </span>
                  </div>
                  <div className="grid gap-2">
                    {NUTRITION_PILLARS.map((pillar) => {
                      const count = weekSummary.pillarCounts[pillar]
                      const meta = NUTRITION_PILLAR_META[pillar]
                      const pct =
                        weekSummary.plannedDayCount > 0
                          ? Math.round((count / weekSummary.plannedDayCount) * 100)
                          : 0
                      return (
                        <div key={pillar} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-foreground">{meta.label}</span>
                            <span className="text-muted-foreground tabular-nums">
                              {count}/{weekSummary.plannedDayCount} ngày
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full transition-[width]",
                                count > 0 ? "bg-primary" : "bg-transparent"
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-[0.6875rem] text-muted-foreground">{meta.tip}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {daysWithHints.length > 0 ? (
                  <div className="space-y-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs">
                    <h3 className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                      <TriangleAlertIcon aria-hidden className="size-4" />
                      Gợi ý cân bằng nhẹ nhàng
                    </h3>
                    <ul className="space-y-1.5 text-amber-900/90 dark:text-amber-200/90">
                      {daysWithHints.map((item) => (
                        <li key={item.day}>
                          <span className="font-semibold">{DAY_LABELS[item.day]}:</span>{" "}
                          {item.hints.join(" ")}
                        </li>
                      ))}
                    </ul>
                    {onAskAssistant && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-1"
                        onClick={() => {
                          setSheetOpen(false)
                          onAskAssistant(buildBalancePrompt(plan, nutrition))
                        }}
                      >
                        <SparklesIcon aria-hidden />
                        Nhờ trợ lý điều chỉnh tuần này
                      </Button>
                    )}
                  </div>
                ) : weekSummary.plannedDayCount > 0 ? (
                  <p className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2Icon aria-hidden className="size-4 shrink-0" />
                    Các ngày đã xếp đầy đủ bữa hiện đang khá hài hòa với mục tiêu của bạn.
                  </p>
                ) : null}
                </div>
              </TabsContent>

              <TabsContent value="bmi">
                <div className="space-y-4">
                  {renderBmiTabContent()}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
